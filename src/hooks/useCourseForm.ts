import { minutesToTime, timeToMinutes, today } from '@/utils/time'
import { computed, ref } from 'vue'

/** 时间选择器选项：00:00 - 24:00，1 分钟一档 */
export function useTimeOptions() {
  const timeOptions = computed(() => {
    const list: string[] = []
    for (let m = 0; m <= 1440; m += 1)
      list.push(minutesToTime(m))
    return list
  })

  /** 小时列表（00-24） */
  const hourOptions = computed(() => {
    const list: string[] = []
    for (let h = 0; h <= 24; h++)
      list.push(String(h).padStart(2, '0'))
    return list
  })

  /** 分钟列表（00,01,02...59） */
  const minuteOptions = computed(() => {
    const list: string[] = []
    for (let m = 0; m <= 59; m += 1)
      list.push(String(m).padStart(2, '0'))
    return list
  })

  /** 双列时间选择器 columns：[小时列表, 分钟列表] */
  const timeColumns = computed(() => [hourOptions.value, minuteOptions.value])

  /** 将 HH:mm 转为 [hour, minute] 数组（用于 wd-picker v-model） */
  function timeToArr(time: string): (string)[] {
    const parts = time.split(':')
    const h = parts[0] ?? '09'
    // 24:00 的分钟列选 00
    const m = h === '24' ? '00' : (parts[1] ?? '00')
    return [h.padStart(2, '0'), m.padStart(2, '0')]
  }

  /** 将 [hour, minute] 数组转回 HH:mm */
  function arrToTime(arr: (string | number)[]): string {
    const h = String(arr[0] ?? '09').padStart(2, '0')
    const m = String(arr[1] ?? '00').padStart(2, '0')
    return `${h}:${m}`
  }

  /** 将 HH:mm 转为在 timeOptions 中的索引 */
  function timeToIndex(time: string): number {
    const idx = timeOptions.value.indexOf(time)
    return idx >= 0 ? idx : 0
  }

  /** 将索引转回 HH:mm */
  function indexToTime(idx: number): string {
    return timeOptions.value[idx] ?? '09:00'
  }

  return {
    timeOptions,
    hourOptions,
    minuteOptions,
    timeColumns,
    timeToArr,
    arrToTime,
    timeToIndex,
    indexToTime,
  }
}

/** 课程编辑表单状态 */
export function useCourseForm() {
  const editId = ref<string | null>(null)
  const isCopyMode = ref(false)
  const studentName = ref('')
  const name = ref('')
  const meetingUrl = ref('')
  const startDate = ref(today())
  const endDate = ref(today())
  const startTime = ref('09:00')
  const endTime = ref('10:00')
  const feeRaw = ref('')

  const isEdit = computed(() => !!editId.value && !isCopyMode.value)
  const isCrossDay = computed(() => endDate.value > startDate.value)

  function buildDraft() {
    return {
      studentName: studentName.value.trim(),
      name: name.value.trim() || undefined,
      startDate: startDate.value,
      endDate: endDate.value,
      startTime: startTime.value,
      endTime: endTime.value,
      fee: feeRaw.value === '' ? undefined : Number(feeRaw.value),
      meetingUrl: meetingUrl.value.trim() || undefined,
    }
  }

  function validate(): string {
    if (!studentName.value.trim())
      return '请填写学生姓名'
    if (endDate.value < startDate.value)
      return '结束日期不能早于开始日期'
    if (timeToMinutes(endTime.value) <= timeToMinutes(startTime.value))
      return '结束时间需晚于开始时间'
    if (feeRaw.value !== '' && (Number.isNaN(Number(feeRaw.value)) || Number(feeRaw.value) < 0))
      return '课时费格式不正确'
    return ''
  }

  function reset() {
    editId.value = null
    isCopyMode.value = false
    studentName.value = ''
    name.value = ''
    meetingUrl.value = ''
    startDate.value = today()
    endDate.value = today()
    startTime.value = '09:00'
    endTime.value = '10:00'
    feeRaw.value = ''
  }

  return {
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
    reset,
  }
}
