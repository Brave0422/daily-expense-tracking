<script setup lang="ts">
/**
 * @author Brave
 * @date 2026-09-20T15:25:44+08:00
 * @description 鉴权表单输入控件，统一标签、错误提示与密码显隐交互。
 */

import { computed, ref } from 'vue'

interface Props {
  autocomplete?: string
  error?: string
  id: string
  inputmode?: 'email' | 'numeric' | 'text'
  label: string
  maxlength?: number
  modelValue: string
  placeholder?: string
  type?: 'email' | 'password' | 'text'
}

const props = withDefaults(defineProps<Props>(), {
  autocomplete: 'off',
  error: '',
  inputmode: 'text',
  maxlength: undefined,
  placeholder: '',
  type: 'text',
})

const emit = defineEmits<{
  'update:modelValue': [value: string]
}>()

const isPasswordVisible = ref(false)
const resolvedType = computed(() => {
  if (props.type !== 'password') {
    return props.type
  }
  return isPasswordVisible.value ? 'text' : 'password'
})

/**
 * 把原生输入事件转换为组件的 v-model 更新事件。
 * @param event - 输入框触发的原生事件
 */
function handleInput(event: Event): void {
  emit('update:modelValue', (event.target as HTMLInputElement).value)
}
</script>

<template>
  <!-- 统一的输入标签、控件和字段级错误区域 -->
  <div class="form-field">
    <label class="form-field__label" :for="props.id">{{ props.label }}</label>
    <div class="form-field__control" :class="{ 'form-field__control--error': props.error }">
      <input
        :id="props.id"
        :autocomplete="props.autocomplete"
        class="form-field__input"
        :inputmode="props.inputmode"
        :maxlength="props.maxlength"
        :placeholder="props.placeholder"
        :type="resolvedType"
        :value="props.modelValue"
        @input="handleInput"
      />
      <button
        v-if="props.type === 'password'"
        :aria-label="isPasswordVisible ? '隐藏密码' : '显示密码'"
        class="form-field__toggle"
        type="button"
        @click="isPasswordVisible = !isPasswordVisible"
      >
        {{ isPasswordVisible ? '隐藏' : '显示' }}
      </button>
    </div>
    <p v-if="props.error" class="form-field__error" role="alert">{{ props.error }}</p>
  </div>
</template>

<style scoped>
/* 字段垂直结构与标签 */
.form-field {
  display: grid;
  gap: 8px;
}

.form-field__label {
  color: var(--color-text);
  font-size: 14px;
  font-weight: 600;
}

/* 输入控件统一承载聚焦、错误和密码显隐状态 */
.form-field__control {
  display: flex;
  min-height: 46px;
  overflow: hidden;
  background: #f8f9fa;
  border: 1px solid var(--color-border);
  border-radius: 12px;
  transition:
    border-color 0.2s,
    box-shadow 0.2s,
    background-color 0.2s;
}

.form-field__control:focus-within {
  background: var(--color-surface);
  border-color: var(--color-primary-active);
  box-shadow: 0 0 0 3px rgb(255 230 57 / 20%);
}

.form-field__control--error {
  border-color: var(--color-danger);
}

.form-field__input {
  flex: 1;
  width: 100%;
  min-width: 0;
  padding: 0 14px;
  color: var(--color-text);
  background: transparent;
  border: 0;
  outline: 0;
}

.form-field__input::placeholder {
  color: #a5a8ad;
}

.form-field__toggle {
  flex: none;
  min-width: 58px;
  padding: 0 14px;
  color: var(--color-text-secondary);
  background: transparent;
  border: 0;
  cursor: pointer;
}

.form-field__toggle:hover {
  color: var(--color-text);
}

/* 错误信息紧邻对应输入，避免与表单级错误混淆 */
.form-field__error {
  margin: 0;
  color: var(--color-danger);
  font-size: 12px;
  line-height: 1.4;
}
</style>
