<script setup lang="ts">
import type { ExportFile } from '@/types/course'
import { buildExportFile, exportFileApp, pickImportFileApp, validateImportFile } from '@/utils/file-io'

definePage({
  style: {
    navigationBarTitleText: '设置',
  },
})

const courseStore = useCourseStore()
const templateStore = useTemplateStore()
const recycleStore = useRecycleStore()
const appStore = useAppStore()

const defaultFeeRaw = ref(appStore.settings.defaultFee != null ? String(appStore.settings.defaultFee) : '')
watch(defaultFeeRaw, (v) => {
  appStore.updateSettings({ defaultFee: v === '' ? undefined : Number(v) })
})

// ---------- 导出 ----------
function exportData() {
  const data = buildExportFile(courseStore.courses, templateStore.templates, appStore.settings)
  const date = new Date().toISOString().slice(0, 10)
  const filename = `课程表备份_${date}.json`
  // #ifdef H5
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
  uni.showToast({ title: '已导出', icon: 'success' })
  // #endif
  // #ifdef APP
  uni.showLoading({ title: '导出中...', mask: true })
  exportFileApp(data, filename)
    .then((filePath) => {
      uni.hideLoading()
      uni.showModal({
        title: '导出成功',
        content: `备份文件已保存到：${filePath}`,
        showCancel: true,
        confirmText: '打开目录',
        success: (res) => {
          if (res.confirm) {
            plus.runtime.openFile(filePath)
          }
        },
      })
    })
    .catch(() => {
      uni.hideLoading()
      uni.showToast({ title: '导出失败', icon: 'none' })
    })
  // #endif
  // #ifdef MP
  uni.showModal({
    title: '暂不支持',
    content: '小程序端暂不支持文件导出，请使用 H5 或 APP 端导出备份文件。',
    showCancel: false,
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
        uni.showToast({ title: '文件不是合法的 JSON', icon: 'none' })
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
        uni.showToast({ title: err.message || '导入失败', icon: 'none' })
      }
    })
  // #endif
  // #ifdef MP
  uni.showModal({
    title: '暂不支持',
    content: '小程序端暂不支持文件导入，请使用 H5 或 APP 端导入备份文件。',
    showCancel: false,
  })
  // #endif
}

function handleImportParsed(raw: unknown) {
  const result = validateImportFile(raw)
  if (!result.ok) {
    uni.showModal({
      title: '导入失败',
      content: (result as { ok: false, error: string }).error,
      showCancel: false,
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
  uni.showToast({ title: '导入成功', icon: 'success' })
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
  uni.showModal({
    title: '清空全部数据',
    content: '将删除所有课程、模板与回收站数据，且不可恢复。确定继续？',
    confirmColor: '#ef4444',
    success: (res) => {
      if (res.confirm) {
        courseStore.clearAll()
        templateStore.templates = []
        recycleStore.clear()
        uni.showToast({ title: '已清空', icon: 'none' })
      }
    },
  })
}

const courseCount = computed(() => courseStore.courses.length)

function goTemplates() {
  uni.navigateTo({ url: '/pages/templates/templates' })
}
function goRecycle() {
  uni.navigateTo({ url: '/pages/recycle/recycle' })
}
</script>

<template>
  <view class="h-screen flex flex-col overflow-hidden bg-gray-50">
    <!-- 自定义导航栏 -->
    <NavBar title="设置" />
    <!-- 滚动内容区 -->
    <view class="h-0 min-h-0 flex-1 overflow-y-auto px-3 pb-safe">
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
            title="从文件导入（导入前自动校验）"
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

      <view class="mt-8 text-center text-2xs text-gray-400">
        所有数据仅保存在本机，请定期导出备份
      </view>
    </view>

    <!-- 导入预览弹窗 -->
    <wd-popup
      :model-value="importPreview?.visible ?? false"
      position="center"
      @close="closeImportPreview"
    >
      <view class="w-320px rounded-2xl bg-white p-5">
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
        <view class="mt-4 flex gap-3">
          <wd-button variant="plain" block @click="closeImportPreview">
            取消
          </wd-button>
          <wd-button block type="primary" @click="doImport('append')">
            仅追加
          </wd-button>
          <wd-button block type="primary" @click="doImport('merge')">
            合并覆盖
          </wd-button>
        </view>
      </view>
    </wd-popup>
  </view>
</template>
