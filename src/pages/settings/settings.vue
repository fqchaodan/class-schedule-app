<script setup lang="ts">
import type { ExportFile } from '@/types/course'
import { DEFAULT_SCHEDULE_ID } from '@/types/course'
import { buildExportFile, downloadJsonH5, exportFileApp, exportFileMp, pickImportFileApp, pickImportFileMp, summarizeImport, validateImportFile } from '@/utils/file-io'
import { clearAllNotificationTimers, requestNotificationPermission, rescheduleNotifications, scheduleCourseNotifications, stopForegroundService } from '@/utils/notification'
import { safeAreaBottom, statusBarHeight } from '@/utils/systemInfo'
import { bottomBarHeight, isTablet } from '@/store/device'
import { lightTap } from '@/utils/feedback'
import { today } from '@/utils/time'
import { useDialog } from '@wot-ui/ui/components/wd-dialog'
import { useToast } from '@wot-ui/ui/components/wd-toast'

definePage({
  style: {
    navigationBarTitleText: '设置',
    navigationStyle: 'custom',
  },
})

const courseStore = useCourseStore()
const templateStore = useTemplateStore()
const recycleStore = useRecycleStore()
const scheduleStore = useScheduleStore()
const appStore = useAppStore()
const dialog = useDialog()
const toast = useToast()

// 每次进入设置页兜底修复课表状态（持久化水合后默认课表缺失 / 激活 id 失效等异常）
onShow(() => {
  scheduleStore.ensureValid()
})

const defaultFeeRaw = ref(appStore.settings.defaultFee != null ? String(appStore.settings.defaultFee) : '')
watch(defaultFeeRaw, (v) => {
  appStore.updateSettings({ defaultFee: v === '' ? undefined : Number(v) })
})

// ---------- 课表管理 ----------
/** 课表列表（附每张课表的课程数，含默认课表） */
const scheduleRows = computed(() => {
  const counts = new Map<string, number>()
  for (const c of courseStore.courses) {
    const sid = c.scheduleId ?? DEFAULT_SCHEDULE_ID
    counts.set(sid, (counts.get(sid) ?? 0) + 1)
  }
  return scheduleStore.schedules.map(s => ({
    ...s,
    count: counts.get(s.id) ?? 0,
    isDefault: s.id === DEFAULT_SCHEDULE_ID,
  }))
})

const schedulePopupVisible = ref(false)
const schedulePopupMode = ref<'create' | 'rename'>('create')
const scheduleEditingId = ref<string | null>(null)
const scheduleNameInput = ref('')

/** 当前正在编辑的课表行（重命名模式下用） */
const editingRow = computed(() =>
  schedulePopupMode.value === 'rename' && scheduleEditingId.value
    ? scheduleRows.value.find(r => r.id === scheduleEditingId.value)
    : undefined,
)

/** 重命名模式下是否可删除：仅默认课表不可删除（有课程的课表删除时课程移入回收站） */
const canDeleteEditing = computed(() => {
  const row = editingRow.value
  return !!row && !row.isDefault
})

/** 是否显示可用的「设为当前」：重命名模式且目标不是当前课表 */
const canSwitchEditing = computed(() =>
  schedulePopupMode.value === 'rename'
  && scheduleEditingId.value != null
  && scheduleEditingId.value !== scheduleStore.activeId,
)

function openCreateSchedule() {
  lightTap()
  schedulePopupMode.value = 'create'
  scheduleEditingId.value = null
  scheduleNameInput.value = ''
  schedulePopupVisible.value = true
}

function openManageSchedule(row: { id: string, name: string }) {
  lightTap()
  schedulePopupMode.value = 'rename'
  scheduleEditingId.value = row.id
  scheduleNameInput.value = row.name
  schedulePopupVisible.value = true
}

function confirmSchedulePopup() {
  const name = scheduleNameInput.value.trim()
  if (!name) {
    toast.error('请输入课表名称')
    return
  }
  if (schedulePopupMode.value === 'create') {
    scheduleStore.createSchedule(name)
    toast.success(`已创建「${name}」，可在首页点击标题切换`)
  }
  else if (scheduleEditingId.value) {
    const ok = scheduleStore.renameSchedule(scheduleEditingId.value, name)
    if (!ok) {
      toast.error('重命名失败，请重试')
      return
    }
    toast.success('已重命名')
  }
  schedulePopupVisible.value = false
}

function switchToEditing() {
  const id = scheduleEditingId.value
  if (!id)
    return
  if (!scheduleStore.switchTo(id)) {
    toast.error('切换失败，请重试')
    return
  }
  schedulePopupVisible.value = false
  const name = scheduleStore.schedules.find(s => s.id === id)?.name ?? ''
  toast.show(`已切换到「${name}」`)
}

function removeEditingSchedule() {
  const id = scheduleEditingId.value
  const row = editingRow.value
  if (!id || !row)
    return
  if (row.isDefault) {
    toast.error('默认课表不能删除')
    return
  }
  const msg = row.count > 0
    ? `「${row.name}」下还有 ${row.count} 节课，删除课表后这些课程将移入回收站（可恢复）。确定删除？`
    : `确定删除空课表「${row.name}」？`
  dialog
    .confirm({
      title: '删除课表',
      msg,
      confirmButtonProps: { type: 'danger' },
    })
    .then(() => {
      // 先迁移课程再删课表（store 仍拒绝删除非空课表，作为最后防线）
      const moved = courseStore.removeCoursesOfSchedule(id)
      const ok = scheduleStore.removeSchedule(id, false)
      if (!ok) {
        toast.error('删除失败，请重试')
        return
      }
      schedulePopupVisible.value = false
      toast.show(moved > 0 ? `已删除，${moved} 节课已移入回收站` : '已删除')
    })
    .catch(() => {})
}

// ---------- 导出 ----------
function exportData() {
  lightTap()
  const data = buildExportFile(courseStore.courses, templateStore.templates, appStore.settings, scheduleStore.schedules)
  const date = today()
  const filename = `课程表备份_${date}.json`
  // #ifdef H5
  downloadJsonH5(data, filename)
  toast.success('已导出')
  // #endif
  // #ifdef APP
  uni.showLoading({ title: '导出中...', mask: true })
  // Android 6.0–10 需要动态申请存储权限；Android 11(API 30) 起分区存储强制生效，
  // WRITE_EXTERNAL_STORAGE 已无法用于写公共目录，申请只会弹一个无意义的授权框，
  // 因此直接跳过，导出自动回退到应用沙盒路径
  const requestStoragePermission = () => {
    return new Promise<boolean>((resolve) => {
      if (plus.os.name !== 'Android') {
        resolve(true)
        return
      }
      const sdkInt = Number(plus.os.version || 0)
      if (sdkInt >= 30) {
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
  // 注意：不要用 showLoading 兜在中间——导出写入是同步的、瞬间完成，
  // 且 shareFileMessage 必须与本次点击处于同一同步调用栈才能调起转发面板
  exportFileMp(data, filename)
    .then(() => {
      dialog.alert({
        title: '导出完成',
        msg: '转发到「文件传输助手」或任意聊天即可长期保存；若刚才取消了分享，再次点击「导出全部数据」即可重新发送。',
      })
    })
    .catch((err: Error) => {
      toast.error(err?.message || '导出失败')
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
  uni.showLoading({ title: '请选择文件...', mask: true })
  pickImportFileMp()
    .then((raw) => {
      uni.hideLoading()
      handleImportParsed(raw)
    })
    .catch((err: Error) => {
      uni.hideLoading()
      if (err.message !== '仅支持小程序端' && err.message !== '未选择文件') {
        toast.error(err.message || '导入失败')
      }
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
  const stats = summarizeImport(result.data.courses, courseStore.courses)
  importPreview.value = { visible: true, raw, data: result.data, ...stats }
}

function doImport(mode: 'merge' | 'append') {
  const preview = importPreview.value
  if (!preview)
    return
  const { courses, templates, settings, schedules } = preview.data
  // 先合并课表定义，保证课程归属的课表 id 有效
  if (schedules?.length) {
    if (mode === 'merge')
      scheduleStore.schedules = mergeById(scheduleStore.schedules, schedules)
    else
      scheduleStore.schedules.push(...schedules.filter(s => !scheduleStore.schedules.some(t => t.id === s.id)))
  }
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
  scheduleStore.ensureValid()
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
      msg: '将删除所有课程、课表、模板与回收站数据，且不可恢复。确定继续？',
      confirmButtonProps: { type: 'danger' },
    })
    .then(() => {
      courseStore.clearAll()
      templateStore.templates = []
      recycleStore.clear()
      scheduleStore.reset()
      // 清掉待发送的定时通知，避免清空后仍弹出已删课程的提醒
      clearAllNotificationTimers()
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
/** 仅 APP 端支持系统级课前提醒（小程序/ H5 无后台定时通知能力） */
const supportsNotification = ref(true)
// #ifndef APP-PLUS
supportsNotification.value = false
// #endif

const notificationEnabled = computed({
  get: () => appStore.settings.notificationEnabled ?? false,
  set: (val: boolean) => {
    appStore.updateSettings({ notificationEnabled: val })
    if (val) {
      // #ifdef APP-PLUS
      requestNotificationPermission().then((granted) => {
        if (granted) {
          scheduleCourseNotifications(courseStore.activeCourses, appStore.settings)
          toast.success('通知已开启')
        }
        else {
          toast.error('需要通知权限才能发送提醒，请到系统设置中开启')
        }
      })
      // #endif
    }
    else {
      // #ifdef APP-PLUS
      // 关闭提醒：停止前台保活并清除待发送的定时器，避免残留常驻通知
      stopForegroundService()
      clearAllNotificationTimers()
      // #endif
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
      rescheduleNotifications(courseStore.activeCourses, appStore.settings)
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
      :style="{ paddingBottom: `${bottomBarHeight + safeAreaBottom + 16}px` }"
    >
      <!-- 课表管理 -->
      <view class="mt-4">
        <view class="section-label">
          课表管理（多老师多课表）
        </view>
        <wd-cell-group border rounded>
          <wd-cell
            v-for="row in scheduleRows"
            :key="row.id"
            :title="row.name"
            :custom-title-class="row.id === scheduleStore.activeId ? 'font-medium text-indigo-600' : ''"
            is-link
            @click="openManageSchedule(row)"
          >
            <!-- 当前课表用对勾标识；其余行留同宽空位，保证名称对齐 -->
            <template #prefix>
              <view class="mr-2.5 w-5 flex shrink-0 items-center">
                <view
                  v-if="row.id === scheduleStore.activeId"
                  class="i-carbon-checkmark-filled text-lg text-indigo-500"
                />
              </view>
            </template>
            <template #default>
              <text class="text-2xs text-gray-400">{{ row.count }} 节课</text>
            </template>
          </wd-cell>
        </wd-cell-group>
        <view
          class="mt-2.5 h-12 flex items-center justify-center gap-1 border border-indigo-200 rounded-xl border-dashed bg-indigo-50/50 active:bg-indigo-100"
          hover-class="bg-indigo-100"
          @click="openCreateSchedule"
        >
          <view class="i-carbon-add text-base text-indigo-500" />
          <text class="text-sm text-indigo-600">新建课表</text>
        </view>
        <view class="mt-2 px-2 text-2xs text-gray-400 leading-relaxed">
          每张课表对应一位老师，课程相互独立。点击首页顶部课表名可快速切换。
        </view>
      </view>

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
            custom-title-class="!text-red-500"
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

      <!-- 课前通知（系统级定时提醒仅 APP 端支持） -->
      <view class="mt-4">
        <view class="section-label">
          课前通知
        </view>
        <template v-if="supportsNotification">
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
            <br>
            提醒依赖应用进程存活，请勿在系统设置中限制本应用的后台运行。
          </view>
        </template>
        <view v-else class="card px-3.5 py-3 text-xs text-gray-500 leading-relaxed">
          小程序端受系统限制暂不支持课前提醒（无法在后台定时唤起系统通知），需要该功能请使用安卓 App 端。
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

    <!-- 课表新建/管理弹窗 -->
    <wd-popup
      :model-value="schedulePopupVisible"
      position="center"
      @close="schedulePopupVisible = false"
    >
      <view class="max-w-360px w-85vw rounded-2xl bg-white p-5">
        <view class="text-base text-gray-900 font-medium">
          {{ schedulePopupMode === 'create' ? '新建课表' : '课表设置' }}
        </view>
        <view class="mt-3">
          <wd-input
            v-model="scheduleNameInput"
            placeholder="输入课表名称，如：张老师"
            clearable
            :maxlength="20"
          />
        </view>
        <view class="mt-4 flex flex-col gap-2">
          <!-- 固定按钮结构：不用 v-if 增删按钮（小程序端条件渲染的同类型组件实例可能被复用导致事件失效），只切文案/禁用态 -->
          <wd-button
            key="schedule-pop-save"
            block
            type="primary"
            @click="confirmSchedulePopup"
          >
            {{ schedulePopupMode === 'create' ? '创建' : '保存名称' }}
          </wd-button>
          <wd-button
            key="schedule-pop-switch"
            block
            type="primary"
            variant="plain"
            :disabled="!canSwitchEditing"
            @click="switchToEditing"
          >
            设为当前课表
          </wd-button>
          <wd-button
            key="schedule-pop-remove"
            block
            variant="plain"
            :disabled="!canDeleteEditing"
            @click="removeEditingSchedule"
          >
            删除课表
          </wd-button>
          <wd-button
            key="schedule-pop-close"
            block
            variant="plain"
            @click="schedulePopupVisible = false"
          >
            关闭
          </wd-button>
        </view>
        <view
          v-if="schedulePopupMode === 'rename' && editingRow?.isDefault"
          class="mt-2 text-2xs text-gray-400"
        >
          默认课表不可删除（课程可正常增删）
        </view>
      </view>
    </wd-popup>

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
