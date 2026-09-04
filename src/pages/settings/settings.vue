<script setup lang="ts">
import type { ExportFile } from '@/types/course'
import { buildExportFile, exportFileApp, pickImportFileApp, validateImportFile } from '@/utils/file-io'
import { requestNotificationPermission, rescheduleNotifications, scheduleCourseNotifications } from '@/utils/notification'
import { safeAreaBottom, statusBarHeight } from '@/utils/systemInfo'
import { bottomBarHeight, isTablet } from '@/store/device'
import { lightTap } from '@/utils/feedback'
import { today } from '@/utils/time'
import { useDialog, useToast } from '@wot-ui/ui'

definePage({
  style: {
    navigationBarTitleText: '设置',
    navigationStyle: 'custom',
  },
})

const courseStore = useCourseStore()
const templateStore = useTemplateStore()
const recycleStore = useRecycleStore()
const appStore = useAppStore()
const dialog = useDialog()
const toast = useToast()

const defaultFeeRaw = ref(appStore.settings.defaultFee != null ? String(appStore.settings.defaultFee) : '')
watch(defaultFeeRaw, (v) => {
  appStore.updateSettings({ defaultFee: v === '' ? undefined : Number(v) })
})

// ---------- 导出 ----------
function exportData() {
  lightTap()
  const data = buildExportFile(courseStore.courses, templateStore.templates, appStore.settings)
  const date = today()
  const filename = `课程表备份_${date}.json`
  // #ifdef H5
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
  toast.success('已导出')
  // #endif
  // #ifdef APP
  uni.showLoading({ title: '导出中...', mask: true })
  // Android 6.0+ 需要动态请求存储权限
  const requestStoragePermission = () => {
    return new Promise<boolean>((resolve) => {
      if (plus.os.name !== 'Android') {
        resolve(true)
        return
      }
      const permissions = [
        'android.permission.WRITE_EXTERNAL_STORAGE',
        'android.permission.READ_EXTERNAL_STORAGE',
      ]
      plus.android.requestPermissions(
        permissions,
        () => resolve(true),
        () => resolve(false),
      )
    })
  }
  requestStoragePermission().then((granted) => {
    if (!granted) {
      uni.hideLoading()
      toast.error('需要存储权限才能导出文件')
      return
    }
    exportFileApp(data, filename)
      .then((filePath) => {
        uni.hideLoading()
        const isDownload = filePath.includes('/Download/')
        const locationHint = isDownload
          ? `文件已保存到手机「下载」文件夹\n文件名：${filename}`
          : `备份文件已保存到应用沙盒目录\n文件名：${filename}`
        dialog
          .confirm({
            title: '导出成功',
            msg: isDownload
              ? `${locationHint}\n\n可打开手机「文件管理器」→「下载」目录查看。`
              : locationHint,
            confirmButtonText: '打开文件',
          })
          .then(() => {
            plus.runtime.openFile(filePath)
          })
          .catch(() => {})
      })
      .catch(() => {
        uni.hideLoading()
        toast.error('导出失败')
      })
  })
  // #endif
  // #ifdef MP
  dialog.alert({
    title: '暂不支持',
    msg: '小程序端暂不支持文件导出，请使用 H5 或 APP 端导出备份文件。',
  })
  // #endif
}

// ---------- 导入 ----------
const importPreview = ref<{
  visible: boolean
  raw: unknown
  data: ExportFile
  addCount: number
  overwriteCount: number
  conflictCount: number
} | null>(null)

function pickImportFile() {
  lightTap()
  // #ifdef H5
  const input = document.createElement('input')
  input.type = 'file'
  input.accept = '.json,application/json'
  input.onchange = () => {
    const file = input.files?.[0]
    if (!file)
      return
    const reader = new FileReader()
    reader.onload = () => {
      try {
        const raw = JSON.parse(String(reader.result))
        handleImportParsed(raw)
      }
      catch {
        toast.error('文件不是合法的 JSON')
      }
    }
    reader.readAsText(file)
  }
  input.click()
  // #endif
  // #ifdef APP
  uni.showLoading({ title: '请选择文件...', mask: true })
  pickImportFileApp()
    .then((raw) => {
      uni.hideLoading()
      handleImportParsed(raw)
    })
    .catch((err: Error) => {
      uni.hideLoading()
      if (err.message !== '仅支持 APP 端' && err.message !== '未选择文件') {
        toast.error(err.message || '导入失败')
      }
    })
  // #endif
  // #ifdef MP
  dialog.alert({
    title: '暂不支持',
    msg: '小程序端暂不支持文件导入，请使用 H5 或 APP 端导入备份文件。',
  })
  // #endif
}

function handleImportParsed(raw: unknown) {
  const result = validateImportFile(raw)
  if (!result.ok) {
    dialog.alert({
      title: '导入失败',
      msg: (result as { ok: false, error: string }).error,
    })
    return
  }
  const incoming = result.data.courses
  const existingIds = new Set(courseStore.courses.map(c => c.id))
  const addCount = incoming.filter(c => !existingIds.has(c.id)).length
  const overwriteCount = incoming.length - addCount
  const conflictCount = incoming.filter(c => courseStore.detectConflicts(c, c.id).length > 0).length
  importPreview.value = { visible: true, raw, data: result.data, addCount, overwriteCount, conflictCount }
}

function doImport(mode: 'merge' | 'append') {
  const preview = importPreview.value
  if (!preview)
    return
  const { courses, templates, settings } = preview.data
  if (mode === 'merge') {
    courseStore.replaceById(courses)
    templateStore.templates = mergeById(templateStore.templates, templates)
  }
  else {
    const existingIds = new Set(courseStore.courses.map(c => c.id))
    courseStore.insertMany(courses.filter(c => !existingIds.has(c.id)))
    const existingTplIds = new Set(templateStore.templates.map(t => t.id))
    templateStore.templates.push(...templates.filter(t => !existingTplIds.has(t.id)))
  }
  if (settings && mode === 'merge')
    appStore.updateSettings(settings)
  importPreview.value = null
  toast.success('导入成功')
}

function mergeById<T extends { id: string }>(current: T[], incoming: T[]): T[] {
  const map = new Map(current.map(item => [item.id, item]))
  for (const item of incoming)
    map.set(item.id, item)
  return Array.from(map.values())
}

function closeImportPreview() {
  importPreview.value = null
}

// ---------- 清空 ----------
function clearAll() {
  lightTap()
  dialog
    .confirm({
      title: '清空全部数据',
      msg: '将删除所有课程、模板与回收站数据，且不可恢复。确定继续？',
      confirmButtonColor: '#ef4444',
    })
    .then(() => {
      courseStore.clearAll()
      templateStore.templates = []
      recycleStore.clear()
      toast.show('已清空')
    })
    .catch(() => {})
}

const courseCount = computed(() => courseStore.courses.length)

function goTemplates() {
  lightTap()
  uni.navigateTo({ url: '/pages/templates/templates' })
}
function goRecycle() {
  lightTap()
  uni.navigateTo({ url: '/pages/recycle/recycle' })
}

// ---------- 课前通知 ----------
const notificationEnabled = computed({
  get: () => appStore.settings.notificationEnabled ?? false,
  set: (val: boolean) => {
    appStore.updateSettings({ notificationEnabled: val })
    if (val) {
      // #ifdef APP-PLUS
      requestNotificationPermission().then((granted) => {
        if (granted) {
          const courseStore = useCourseStore()
          scheduleCourseNotifications(courseStore.courses, appStore.settings)
          toast.success('通知已开启')
        }
        else {
          toast.error('需要通知权限才能发送提醒，请到系统设置中开启')
        }
      })
      // #endif
      // #ifndef APP-PLUS
      toast.success('通知已开启')
      // #endif
    }
    else {
      toast.show('通知已关闭')
    }
  },
})

const advanceMinutes = computed({
  get: () => appStore.settings.notificationAdvanceMinutes ?? 15,
  set: (val: number) => {
    appStore.updateSettings({ notificationAdvanceMinutes: val })
    // 重新调度通知
    // #ifdef APP-PLUS
    if (appStore.settings.notificationEnabled) {
      const courseStore = useCourseStore()
      rescheduleNotifications(courseStore.courses, appStore.settings)
    }
    // #endif
  },
})

const advanceOptions = [
  { value: 5, label: '5 分钟' },
  { value: 10, label: '10 分钟' },
  { value: 15, label: '15 分钟' },
  { value: 30, label: '30 分钟' },
  { value: 60, label: '1 小时' },
]
const advanceColumns = advanceOptions.map(o => o.label)
const showAdvancePicker = ref(false)
const advanceLabel = computed(() => {
  const opt = advanceOptions.find(o => o.value === advanceMinutes.value)
  return opt?.label ?? '15 分钟'
})
const advanceArr = computed({
  get: () => [advanceLabel.value],
  set: (val: (string | number)[]) => {
    const idx = advanceColumns.findIndex(label => label === val[0])
    if (idx >= 0)
      advanceMinutes.value = advanceOptions[idx].value
  },
})

const notificationTemplate = computed({
  get: () => appStore.settings.notificationTemplate ?? '即将上课：{student} 的 {course}，时间 {time}',
  set: (val: string) => {
    appStore.updateSettings({ notificationTemplate: val })
  },
})

function onAdvanceConfirm() {
  showAdvancePicker.value = false
}

const templatePlaceholder = '即将上课：{student} 的 {course}，时间 {time}'
const templateHint = '可用变量：{student}=学生姓名，{course}=课程名，{time}=上课时间'
</script>

<template>
  <view class="h-screen flex flex-col overflow-hidden bg-gray-50">
    <!-- 标题行（与首页统一风格） -->
    <view class="shrink-0 from-indigo-50 to-white bg-gradient-to-b" :style="{ paddingTop: `${statusBarHeight}px` }">
      <view class="h-44px flex items-center px-4">
        <view class="flex items-center gap-2">
          <view class="i-carbon-settings text-lg text-indigo-500" />
          <text class="text-lg text-gray-900 font-bold">
            设置
          </text>
        </view>
      </view>
    </view>
    <!-- 滚动内容区（平板端分区两列网格排布，手机单列） -->
    <view
      class="h-0 min-h-0 flex-1 overflow-y-auto px-3"
      :class="isTablet ? 'grid grid-cols-2 items-start gap-x-4' : ''"
      :style="{ paddingBottom: `${bottomBarHeight + safeAreaBottom}px` }"
    >
      <!-- 数据 -->
      <view class="mt-4">
        <view class="section-label">
          数据管理（当前 {{ courseCount }} 节课）
        </view>
        <wd-cell-group border rounded>
          <wd-cell
            title="导出全部数据"
            is-link
            @click="exportData"
          >
            <template #icon>
              <view class="i-carbon-export mr-3 text-xl text-indigo-500" />
            </template>
          </wd-cell>
          <wd-cell
            title="从文件导入"
            is-link
            @click="pickImportFile"
          >
            <template #icon>
              <view class="i-carbon-download mr-3 text-xl text-sky-500" />
            </template>
          </wd-cell>
          <wd-cell
            title="清空全部数据"
            is-link
            @click="clearAll"
          >
            <template #icon>
              <view class="i-carbon-trash-can mr-3 text-xl text-red-500" />
            </template>
            <template #default>
              <text class="text-red-500" />
            </template>
          </wd-cell>
        </wd-cell-group>
      </view>

      <!-- 功能入口 -->
      <view class="mt-4">
        <view class="section-label">
          功能入口
        </view>
        <wd-cell-group border rounded>
          <wd-cell
            title="模板管理"
            is-link
            @click="goTemplates"
          >
            <template #icon>
              <view class="i-carbon-repeat mr-3 text-xl text-violet-500" />
            </template>
            <template #default>
              <text v-if="templateStore.templates.length" class="text-2xs text-gray-400">{{ templateStore.templates.length }} 个</text>
            </template>
          </wd-cell>
          <wd-cell
            title="回收站"
            is-link
            @click="goRecycle"
          >
            <template #icon>
              <view class="i-carbon-delete mr-3 text-xl text-gray-400" />
            </template>
            <template #default>
              <text v-if="recycleStore.items.length" class="text-2xs text-gray-400">{{ recycleStore.items.length }} 条</text>
            </template>
          </wd-cell>
        </wd-cell-group>
      </view>

      <!-- 课前通知 -->
      <view class="mt-4">
        <view class="section-label">
          课前通知
        </view>
        <wd-cell-group border rounded>
          <wd-cell title="开启课前提醒" center custom-style="--wot-switch-size: 16px;">
            <template #default>
              <wd-switch v-model="notificationEnabled" />
            </template>
            <template #icon>
              <view class="i-carbon-notification mr-3 text-xl text-indigo-500" />
            </template>
          </wd-cell>
          <wd-cell
            v-if="notificationEnabled"
            title="提前提醒时间"
            is-link
            center
            @click="showAdvancePicker = true"
          >
            <template #icon>
              <view class="i-carbon-time mr-3 text-xl text-sky-500" />
            </template>
            <template #default>
              <text class="text-sm text-gray-600">{{ advanceLabel }}</text>
            </template>
          </wd-cell>
          <wd-cell
            v-if="notificationEnabled"
            title="通知内容模板"
            center
          >
            <template #icon>
              <view class="i-carbon-text-align-left mr-3 text-xl text-violet-500" />
            </template>
            <template #default>
              <wd-input
                v-model="notificationTemplate"
                :placeholder="templatePlaceholder"
                compact
                clearable
                custom-style="flex: 1; min-width: 80px; text-align: right;"
              />
            </template>
          </wd-cell>
        </wd-cell-group>
        <view v-if="notificationEnabled" class="mt-2 px-2 text-2xs text-gray-400 leading-relaxed">
          {{ templateHint }}
        </view>
      </view>

      <!-- 偏好 -->
      <view class="mt-4">
        <view class="section-label">
          偏好设置
        </view>
        <wd-cell-group border rounded>
          <wd-cell title="默认课时费/节" center>
            <template #default>
              <view class="flex items-center gap-1">
                <wd-input
                  v-model="defaultFeeRaw"
                  type="number"
                  placeholder="未设置"
                  compact
                  custom-style="flex: 1; min-width: 60px; text-align: right;"
                />
                <text class="text-xs text-gray-400">元</text>
              </view>
            </template>
          </wd-cell>
        </wd-cell-group>
      </view>

      <!-- 版权行：平板上跨两列保持居中 -->
      <view class="mt-8 text-center text-2xs text-gray-400" :class="isTablet ? 'col-span-2' : ''">
        所有数据仅保存在本机，请定期导出备份
      </view>
    </view>

    <!-- 提前时间选择器 -->
    <wd-picker
      v-model="advanceArr"
      v-model:visible="showAdvancePicker"
      :columns="advanceColumns"
      title="提前提醒时间"
      @confirm="onAdvanceConfirm"
    />

    <!-- 导入预览弹窗 -->
    <wd-popup
      :model-value="importPreview?.visible ?? false"
      position="center"
      @close="closeImportPreview"
    >
      <view class="max-w-360px w-85vw rounded-2xl bg-white p-5">
        <view class="text-base text-gray-900 font-medium">
          导入预览
        </view>
        <view class="mt-3 rounded-xl bg-gray-50 p-3 text-xs text-gray-600 space-y-1">
          <view>
            课程：新增 {{ importPreview?.addCount }} 条<template v-if="(importPreview?.overwriteCount ?? 0) > 0">
              ，覆盖 {{ importPreview?.overwriteCount }} 条
            </template>
          </view>
          <view>模板：{{ importPreview?.data.templates.length }} 条（同 id 覆盖）</view>
          <view v-if="(importPreview?.conflictCount ?? 0) > 0" class="text-red-500">
            注意：有 {{ importPreview?.conflictCount }} 条课程与现有课程时间冲突，仍会按选择的方式导入
          </view>
        </view>
        <view class="mt-4 flex flex-col gap-2">
          <wd-button block type="primary" @click="doImport('merge')">
            合并覆盖
          </wd-button>
          <wd-button block @click="doImport('append')">
            仅追加
          </wd-button>
          <wd-button block variant="plain" @click="closeImportPreview">
            取消
          </wd-button>
        </view>
      </view>
    </wd-popup>

    <wd-dialog />
    <wd-toast />
  </view>
</template>
