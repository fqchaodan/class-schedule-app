<script setup lang="ts">
import type { Course, NoteType } from '@/types/course'
import { NOTE_TYPE_LABELS, NOTE_TYPE_OPTIONS } from '@/types/course'
import { avatarGradient } from '@/utils/avatar'
import { durationHours, formatDateTime } from '@/utils/time'
import { safeAreaBottom } from '@/utils/systemInfo'
import { lightTap } from '@/utils/feedback'
import { isTablet } from '@/store/device'
import { useDialog, useToast } from '@wot-ui/ui'

definePage({
  style: {
    navigationBarTitleText: '课程详情',
  },
})

const courseStore = useCourseStore()
const dialog = useDialog()
const toast = useToast()

const course = ref<Course | null>(null)
const courseId = ref('')

onLoad((query: any) => {
  if (query?.id) {
    courseId.value = query.id
    course.value = courseStore.getById(query.id) ?? null
  }
})

// ---------- 状态切换 ----------
function toggleStatus() {
  lightTap()
  if (course.value)
    courseStore.toggleCompleted(course.value.id)
}

// ---------- 会议链接 ----------
function copyMeetingUrl() {
  if (!course.value?.meetingUrl)
    return
  uni.setClipboardData({
    data: course.value.meetingUrl,
    success: () => toast.success('链接已复制'),
  })
}

// ---------- 备注 ----------
const noteTypeIdx = ref(0)
const noteContent = ref('')
const showNoteTypePicker = ref(false)
const noteTypeColumns = NOTE_TYPE_OPTIONS.map(o => o.label)

/** wd-picker v-model 需要 Array 类型，做 [number] <-> number 双向转换 */
const noteTypeArr = computed({
  get: () => [noteTypeIdx.value],
  set: (val: (string | number)[]) => {
    const idx = noteTypeColumns.findIndex(label => label === val[0])
    noteTypeIdx.value = idx >= 0 ? idx : Number(val[0]) || 0
  },
})

function onNoteTypeConfirm({ value }: { value: (string | number)[] }) {
  const idx = noteTypeColumns.findIndex(label => label === value[0])
  noteTypeIdx.value = idx >= 0 ? idx : 0
  showNoteTypePicker.value = false
}

function addNote() {
  if (!course.value || !noteContent.value.trim()) {
    toast.error('请填写备注内容')
    return
  }
  lightTap()
  courseStore.addNote(course.value.id, NOTE_TYPE_OPTIONS[noteTypeIdx.value].value as NoteType, noteContent.value)
  noteContent.value = ''
  toast.success('已添加')
}

function removeNote(noteId: string) {
  if (!course.value)
    return
  dialog
    .confirm({
      title: '删除备注',
      msg: '确定删除这条备注？',
    })
    .then(() => {
      if (course.value)
        courseStore.removeNote(course.value.id, noteId)
    })
    .catch(() => {})
}

// ---------- 操作 ----------
function edit() {
  lightTap()
  uni.navigateTo({ url: `/pages/course/edit?id=${courseId.value}` })
}

function copyCourse() {
  lightTap()
  uni.navigateTo({ url: `/pages/course/edit?id=${courseId.value}&copy=1` })
}

function remove() {
  lightTap()
  dialog
    .confirm({
      title: '删除课程',
      msg: '删除后可在"设置-回收站"中恢复，确定删除？',
      confirmButtonColor: '#ef4444',
    })
    .then(() => {
      courseStore.removeCourse(courseId.value)
      toast.show('已移入回收站')
      setTimeout(() => uni.navigateBack(), 400)
    })
    .catch(() => {})
}

const isCrossDay = computed(() => course.value && course.value.endDate > course.value.startDate)
const hours = computed(() => course.value ? durationHours(course.value.startTime, course.value.endTime) : 0)
/** 头像渐变（与 CourseCard 同一 hash 规则，同一学生全站同色） */
const avatarCls = computed(() => avatarGradient(course.value ? (course.value.studentName || course.value.name || '课') : '课'))

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
  <view v-if="course" class="h-screen flex flex-col overflow-hidden bg-gray-50">
    <!-- 自定义导航栏 -->
    <NavBar title="课程详情" />
    <view class="h-0 min-h-0 flex-1 overflow-y-auto px-3 pt-3 pb-actionbar" :class="isTablet ? 'mx-auto max-w-200' : ''">
      <!-- 学生信息头部 -->
      <view class="card p-4">
        <view class="flex items-center gap-3">
          <view
            class="h-14 w-14 flex shrink-0 items-center justify-center rounded-full bg-gradient-to-br text-lg text-white font-medium"
            :class="avatarCls"
          >
            {{ (course.studentName || course.name || '课').slice(0, 1) }}
          </view>
          <view class="min-w-0 flex-1">
            <view class="flex items-center gap-2">
              <text class="truncate text-lg text-gray-900 font-semibold">{{ course.studentName || '未命名' }}</text>
              <wd-tag
                :type="course.completed ? 'success' : 'warning'"
                size="small"
                round
                @click="toggleStatus"
              >
                {{ course.completed ? '已上' : '未上' }}
              </wd-tag>
            </view>
            <view class="mt-1 text-xs text-gray-400">
              {{ course.startDate }} ~ {{ course.endDate }}
              <template v-if="isCrossDay">
                <wd-tag type="primary" size="small">
                  跨天
                </wd-tag>
              </template>
              · {{ course.startTime }} - {{ course.endTime }}（{{ hours }}h）
            </view>
          </view>
        </view>

        <!-- 课程名 / 费用 / 会议 -->
        <view class="mt-3">
          <wd-cell-group border>
            <wd-cell title="课程" :value="course.name || '—'" />
            <wd-cell title="课时费" :value="course.fee != null ? `¥${course.fee}/节` : '—'" />
            <wd-cell v-if="course.meetingUrl" title="腾讯会议" center>
              <template #default>
                <view class="flex items-center justify-end gap-2">
                  <text class="truncate text-indigo-500">{{ course.meetingUrl }}</text>
                  <wd-button type="primary" size="small" variant="plain" @click="copyMeetingUrl">
                    复制
                  </wd-button>
                </view>
              </template>
            </wd-cell>
            <wd-cell v-else title="腾讯会议" value="—" />
          </wd-cell-group>
        </view>
      </view>

      <!-- 备注 -->
      <view class="mb-6 mt-3 card px-4 py-3">
        <view class="mb-2 flex items-center justify-between">
          <text class="txt-body font-medium">课程备注（{{ course.notes.length }}）</text>
        </view>

        <wd-empty v-if="course.notes.length === 0" tip="暂无备注" icon-size="60px" />

        <view v-for="note in course.notes" :key="note.id" class="mb-2 rounded-xl bg-gray-50 p-3">
          <view class="flex items-center justify-between">
            <wd-tag type="primary" size="small">
              {{ NOTE_TYPE_LABELS[note.type] }}
            </wd-tag>
            <view class="flex items-center gap-2 text-2xs text-gray-400">
              <text>{{ formatDateTime(note.createdAt) }}</text>
              <view class="i-carbon-trash-can text-sm text-gray-400 active:text-red-500" @click="removeNote(note.id)" />
            </view>
          </view>
          <view class="mt-1.5 whitespace-pre-wrap txt-body">
            {{ note.content }}
          </view>
        </view>

        <view class="mt-3 border-t border-gray-50 pt-3">
          <view class="mb-2">
            <wd-button size="small" variant="plain" @click="showNoteTypePicker = true">
              {{ noteTypeColumns[noteTypeIdx] }}
            </wd-button>
          </view>
          <wd-textarea
            v-model="noteContent"
            placeholder="输入备注内容：教学内容、学生情况、作业、课后反馈..."
            :maxlength="500"
            show-word-limit
          />
          <view class="mt-2 flex justify-end">
            <wd-button type="primary" size="small" @click="addNote">
              添加备注
            </wd-button>
          </view>
        </view>
      </view>
    </view>

    <!-- 底部操作（fixed 固定视口底部） -->
    <view class="fixed bottom-0 left-0 right-0 z-10 h-15 flex items-center gap-2 border-t border-gray-100 bg-white/95 px-3 backdrop-blur-sm" :style="actionbarStyle">
      <wd-button variant="plain" block @click="copyCourse">
        复制
      </wd-button>
      <wd-button type="primary" block @click="edit">
        编辑
      </wd-button>
      <wd-button type="danger" variant="plain" block @click="remove">
        删除
      </wd-button>
    </view>

    <!-- 备注类型选择器 -->
    <wd-picker
      v-model="noteTypeArr"
      v-model:visible="showNoteTypePicker"
      :columns="noteTypeColumns"
      title="选择备注类型"
      @confirm="onNoteTypeConfirm"
    />

    <wd-dialog />
    <wd-toast />
  </view>

  <wd-empty v-else tip="课程不存在或已被删除" />
</template>
