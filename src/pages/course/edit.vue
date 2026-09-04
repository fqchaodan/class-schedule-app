<script setup lang="ts">
import type { Course, CourseTemplate } from '@/types/course'
import { useCourseForm, useTimeOptions } from '@/hooks/useCourseForm'
import { dateToTimestamp, timestampToDate } from '@/utils/time'
import { safeAreaBottom } from '@/utils/systemInfo'
import { lightTap, successTap } from '@/utils/feedback'
import { isTablet } from '@/store/device'
import { useDialog, useToast } from '@wot-ui/ui'

definePage({
  style: {
    navigationBarTitleText: '新增课程',
  },
})

const courseStore = useCourseStore()
const templateStore = useTemplateStore()
const appStore = useAppStore()

const dialog = useDialog()
const toast = useToast()

const { timeColumns, timeToArr, arrToTime } = useTimeOptions()
const {
  editId,
  isCopyMode,
  studentName,
  name,
  meetingUrl,
  startDate,
  endDate,
  startTime,
  endTime,
  feeRaw,
  isEdit,
  isCrossDay,
  buildDraft,
  validate,
} = useCourseForm()

// ---------- 选择器显隐控制 ----------
const showStartTimePicker = ref(false)
const showEndTimePicker = ref(false)

// ---------- 日历选择器 ref ----------
const startDateCalendarRef = ref()
const endDateCalendarRef = ref()

// ---------- 日期时间戳双向转换 ----------
const startDateTs = computed({
  get: () => dateToTimestamp(startDate.value),
  set: (ts: number) => {
    startDate.value = timestampToDate(ts)
    if (endDate.value < startDate.value)
      endDate.value = startDate.value
  },
})
const endDateTs = computed({
  get: () => dateToTimestamp(endDate.value),
  set: (ts: number) => {
    endDate.value = timestampToDate(ts)
  },
})

function openStartDateCalendar() {
  startDateCalendarRef.value?.open()
}
function openEndDateCalendar() {
  endDateCalendarRef.value?.open()
}

// ---------- 日历确认回调 ----------
function onStartDateConfirm({ value }: { value: number }) {
  startDateTs.value = value
}
function onEndDateConfirm({ value }: { value: number }) {
  endDateTs.value = value
}

// ---------- 课程模板（快速填充） ----------
const courseTemplates = computed(() => templateStore.templates.filter(t => t.kind === 'course'))
const templateColumns = computed(() => courseTemplates.value.map(t => t.name))

const showTemplatePicker = ref(false)
const selectedTemplateIdx = ref(0)

function applyTemplate(tpl: CourseTemplate) {
  studentName.value = tpl.studentName ?? ''
  name.value = tpl.courseName ?? ''
  meetingUrl.value = tpl.meetingUrl ?? ''
  startTime.value = tpl.startTime
  endTime.value = tpl.endTime
  feeRaw.value = tpl.fee != null ? String(tpl.fee) : ''
}

function onTemplateConfirm({ value }: { value: number }) {
  const tpl = courseTemplates.value[value]
  if (tpl) {
    applyTemplate(tpl)
    toast.show('已填充模板，可修改后保存')
  }
  showTemplatePicker.value = false
}

// ---------- 初始化 ----------
onLoad((query: any) => {
  if (query?.id) {
    if (query.copy === '1') {
      const draft = courseStore.duplicateCourse(query.id)
      if (draft) {
        isCopyMode.value = true
        editId.value = null
        studentName.value = draft.studentName
        name.value = draft.name ?? ''
        meetingUrl.value = draft.meetingUrl ?? ''
        startDate.value = draft.startDate
        endDate.value = draft.endDate
        startTime.value = draft.startTime
        endTime.value = draft.endTime
        feeRaw.value = draft.fee != null ? String(draft.fee) : ''
        return
      }
    }
    const course = courseStore.getById(query.id)
    if (course) {
      editId.value = course.id
      studentName.value = course.studentName
      name.value = course.name ?? ''
      meetingUrl.value = course.meetingUrl ?? ''
      startDate.value = course.startDate
      endDate.value = course.endDate
      startTime.value = course.startTime
      endTime.value = course.endTime
      feeRaw.value = course.fee != null ? String(course.fee) : ''
    }
  }
  else if (query?.tplId) {
    const tpl = templateStore.getById(query.tplId)
    if (tpl && tpl.kind === 'course')
      applyTemplate(tpl)
  }
  else if (appStore.settings.defaultFee != null) {
    feeRaw.value = String(appStore.settings.defaultFee)
  }
})

// ---------- 保存 ----------
const conflictDialogVisible = ref(false)
const pendingConflicts = ref<Course[]>([])

function save() {
  lightTap()
  const err = validate()
  if (err) {
    toast.error(err)
    return
  }
  const draft = buildDraft()
  const conflicts = editId.value
    ? courseStore.detectConflicts(draft, editId.value)
    : courseStore.detectConflicts(draft)
  if (conflicts.length > 0) {
    pendingConflicts.value = conflicts
    conflictDialogVisible.value = true
    return
  }
  doSave(false)
}

function doSave(force: boolean) {
  conflictDialogVisible.value = false
  const draft = buildDraft()
  let ok = false
  if (editId.value) {
    ok = courseStore.updateCourse(editId.value, draft, force).length === 0
  }
  else {
    courseStore.addCourse(draft, force)
    ok = true
  }
  if (ok) {
    successTap()
    toast.success('已保存')
    setTimeout(() => uni.navigateBack(), 400)
  }
}

function remove() {
  if (!editId.value)
    return
  lightTap()
  dialog
    .confirm({
      title: '删除课程',
      msg: '删除后可在"设置-回收站"中恢复，确定删除？',
      confirmButtonColor: '#ef4444',
    })
    .then(() => {
      if (editId.value) {
        courseStore.removeCourse(editId.value)
        toast.show('已移入回收站')
        setTimeout(() => uni.navigateBack(), 400)
      }
    })
    .catch(() => {})
}

function saveAsTemplate() {
  lightTap()
  if (!studentName.value.trim()) {
    toast.error('请先填写学生姓名')
    return
  }
  const tpl = templateStore.saveCourseAsTemplate({
    studentName: studentName.value.trim(),
    courseName: name.value.trim() || undefined,
    meetingUrl: meetingUrl.value.trim() || undefined,
    startTime: startTime.value,
    endTime: endTime.value,
    fee: feeRaw.value === '' ? undefined : Number(feeRaw.value),
  })
  toast.success(`已存为模板「${tpl.name}」`)
}

// ---------- 时间选择器 v-model（双列：小时+分钟） ----------
const startTimeArr = computed({
  get: () => timeToArr(startTime.value),
  set: (val: (string | number)[]) => {
    startTime.value = arrToTime(val)
  },
})
const endTimeArr = computed({
  get: () => timeToArr(endTime.value),
  set: (val: (string | number)[]) => {
    endTime.value = arrToTime(val)
  },
})

// ---------- 模板选择器 v-model（数组类型） ----------
const selectedTemplateArr = computed({
  get: () => [selectedTemplateIdx.value],
  set: (val: (string | number)[]) => {
    selectedTemplateIdx.value = Number(val[0]) || 0
  },
})

// ---------- 键盘适配 ----------
const keyboardHeight = ref(0)
const actionbarStyle = computed(() => {
  if (keyboardHeight.value > 0) {
    return {
      position: 'fixed' as const,
      bottom: `${keyboardHeight.value}px`,
      paddingBottom: `${Math.max(safeAreaBottom, 8)}px`,
    }
  }
  return {
    paddingBottom: `${safeAreaBottom}px`,
  }
})

onMounted(() => {
  // #ifdef APP-PLUS
  uni.onKeyboardHeightChange?.((res) => {
    keyboardHeight.value = res.height || 0
  })
  // #endif
})

onUnmounted(() => {
  // #ifdef APP-PLUS
  uni.offKeyboardHeightChange?.()
  // #endif
})
</script>

<template>
  <view class="h-screen flex flex-col overflow-hidden bg-gray-50">
    <!-- 自定义导航栏 -->
    <NavBar :title="isEdit ? '编辑课程' : isCopyMode ? '复制课程' : '新增课程'" />
    <!-- 滚动内容区（底部留出固定操作条的高度） -->
    <view class="h-0 min-h-0 flex-1 overflow-y-auto px-0 pt-3 pb-actionbar" :class="isTablet ? 'mx-auto max-w-180' : ''">
      <!-- 模板选择器 -->
      <wd-cell-group v-if="courseTemplates.length > 0" border rounded class="mx-3">
        <wd-cell
          title="从模板填充"
          :value="`${courseTemplates.length} 个模板`"
          is-link
          center
          @click="showTemplatePicker = true"
        />
      </wd-cell-group>

      <!-- 课程信息 -->
      <view class="mt-3 px-3">
        <wd-cell-group border rounded>
          <wd-cell title="学生姓名" required center title-width="5em">
            <template #default>
              <wd-input
                v-model="studentName"
                placeholder="必填，如：张三"
                compact
                clearable
                custom-style="width: 100%; text-align: right;"
              />
            </template>
          </wd-cell>
          <wd-cell title="课程名" center title-width="5em">
            <template #default>
              <wd-input
                v-model="name"
                placeholder="选填，作为备注"
                compact
                clearable
                custom-style="width: 100%; text-align: right;"
              />
            </template>
          </wd-cell>
          <wd-cell title="会议链接" center title-width="5em">
            <template #default>
              <wd-input
                v-model="meetingUrl"
                placeholder="腾讯会议链接（选填）"
                compact
                clearable
                custom-style="width: 100%; text-align: right;"
              />
            </template>
          </wd-cell>
          <wd-cell title="课时费/节" center title-width="5em">
            <template #default>
              <view class="flex items-center justify-end gap-1">
                <wd-input
                  v-model="feeRaw"
                  type="number"
                  placeholder="选填"
                  compact
                  custom-style="flex: 1; min-width: 80px; text-align: right;"
                />
                <text class="text-xs text-gray-400">元</text>
              </view>
            </template>
          </wd-cell>
        </wd-cell-group>
      </view>

      <!-- 时间 -->
      <view class="mt-3 px-3">
        <wd-cell-group border rounded>
          <wd-cell
            title="开始日期"
            is-link
            center
            title-width="5em"
            @click="openStartDateCalendar"
          >
            <template #default>
              <text class="text-sm" :class="isCrossDay ? 'text-indigo-500' : 'text-gray-800'">{{ startDate }}</text>
            </template>
          </wd-cell>
          <wd-cell
            title="结束日期"
            is-link
            center
            title-width="5em"
            @click="openEndDateCalendar"
          >
            <template #default>
              <view class="flex items-center justify-end gap-2">
                <text class="text-sm text-gray-800">{{ endDate }}</text>
                <wd-tag v-if="isCrossDay" type="primary" size="small">
                  跨天
                </wd-tag>
              </view>
            </template>
          </wd-cell>
          <wd-cell
            title="开始时间"
            is-link
            center
            title-width="5em"
            @click="showStartTimePicker = true"
          >
            <template #default>
              <text class="text-sm text-gray-800">{{ startTime }}</text>
            </template>
          </wd-cell>
          <wd-cell
            title="结束时间"
            is-link
            center
            title-width="5em"
            @click="showEndTimePicker = true"
          >
            <template #default>
              <text class="text-sm text-gray-800">{{ endTime }}</text>
            </template>
          </wd-cell>
        </wd-cell-group>
      </view>
      <view class="mt-2 px-2 text-2xs text-gray-400 leading-relaxed">
        时间任意自定义（1 分钟一档）；结束日期晚于开始日期即为跨天课程，跨天期间每天都会在课表中显示。
      </view>
    </view>

    <!-- 底部操作（fixed 固定视口底部） -->
    <view class="fixed bottom-0 left-0 right-0 z-10 h-15 flex items-center gap-2 border-t border-gray-100 bg-white/95 px-3 backdrop-blur-sm" :style="actionbarStyle">
      <wd-button
        v-if="isEdit"
        type="danger"
        variant="plain"
        block
        @click="remove"
      >
        删除
      </wd-button>
      <wd-button
        type="primary"
        variant="plain"
        block
        icon="save"
        @click="saveAsTemplate"
      >
        存为模板
      </wd-button>
      <wd-button
        type="primary"
        block
        @click="save"
      >
        保存
      </wd-button>
    </view>

    <!-- 模板选择器 -->
    <wd-picker
      v-model="selectedTemplateArr"
      v-model:visible="showTemplatePicker"
      :columns="templateColumns"
      title="选择模板"
      @confirm="onTemplateConfirm"
    />

    <!-- 日历选择器 - 开始日期 -->
    <wd-calendar
      ref="startDateCalendarRef"
      v-model="startDateTs"
      title="开始日期"
      type="date"
      :first-day-of-week="1"
      @confirm="onStartDateConfirm"
    />

    <!-- 日历选择器 - 结束日期 -->
    <wd-calendar
      ref="endDateCalendarRef"
      v-model="endDateTs"
      title="结束日期"
      type="date"
      :first-day-of-week="1"
      @confirm="onEndDateConfirm"
    />

    <!-- 时间选择器 - 开始时间（双列：小时+分钟） -->
    <wd-picker
      v-model="startTimeArr"
      v-model:visible="showStartTimePicker"
      :columns="timeColumns"
      title="开始时间"
    />

    <!-- 时间选择器 - 结束时间（双列：小时+分钟） -->
    <wd-picker
      v-model="endTimeArr"
      v-model:visible="showEndTimePicker"
      :columns="timeColumns"
      title="结束时间"
    />

    <ConflictDialog
      :visible="conflictDialogVisible"
      :conflicts="pendingConflicts"
      @confirm="doSave(true)"
      @cancel="conflictDialogVisible = false"
    />

    <wd-dialog />
    <wd-toast />
  </view>
</template>
