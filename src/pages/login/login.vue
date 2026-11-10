<script setup lang="ts">
import { statusBarHeight } from '@/utils/systemInfo'
import { login } from '@/sync/sync-service'
import { useToast } from '@wot-ui/ui/components/wd-toast'

definePage({
  style: {
    navigationBarTitleText: '登录',
    navigationStyle: 'custom',
  },
})

const toast = useToast()
const account = ref('')
const loading = ref(false)

async function doLogin() {
  const value = account.value.trim()
  if (!value) {
    toast.error('请输入账号')
    return
  }
  if (loading.value)
    return
  loading.value = true
  try {
    await login(value)
    uni.reLaunch({ url: '/pages/index/index' })
  }
  catch (error) {
    toast.error(error instanceof Error ? error.message : '登录失败')
  }
  finally {
    loading.value = false
  }
}
</script>

<template>
  <view class="h-screen flex flex-col overflow-hidden from-indigo-50 to-white bg-gradient-to-b" :style="{ paddingTop: `${statusBarHeight}px` }">
    <view class="flex flex-1 flex-col items-center justify-center px-8">
      <view class="mb-2 h-16 w-16 flex items-center justify-center rounded-2xl bg-indigo-500 shadow-lg">
        <view class="i-carbon-calendar text-3xl text-white" />
      </view>
      <text class="mb-1 text-xl text-gray-900 font-bold">
        番茄课表
      </text>
      <text class="mb-10 text-xs text-gray-400">
        登录以同步你的课表
      </text>

      <view class="max-w-360px w-full rounded-2xl bg-white p-5 shadow-sm">
        <view class="mb-4">
          <text class="mb-2 block text-sm text-gray-600">
            账号
          </text>
          <wd-input
            v-model="account"
            placeholder="请输入账号"
            clearable
            :maxlength="20"
            @confirm="doLogin"
          />
        </view>
        <wd-button block type="primary" :loading="loading" @click="doLogin">
          登录
        </wd-button>
        <view class="mt-3 text-center text-2xs text-gray-300 leading-relaxed">
          主账号可读写，只读账号仅查看；其它账号无法登录
        </view>
      </view>
    </view>

    <wd-toast />
  </view>
</template>
