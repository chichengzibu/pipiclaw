<template>
  <div class="shortcut-recorder" @keyup="handleKeyUp" @keydown="handleKeyDown">
    <el-input
      v-model="displayAccelerator"
      readonly
      placeholder="点击录制快捷键"
      @focus="startRecording"
      @blur="stopRecording"
    >
      <template #prefix>
        <el-icon v-if="recording"><VideoPlay /></el-icon>
        <el-icon v-else><Operation /></el-icon>
      </template>
      <template #suffix>
        <el-button size="small" text @click="reset">
          <el-icon><RefreshLeft /></el-icon>
        </el-button>
      </template>
    </el-input>
  </div>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue';
import { Operation, VideoPlay, RefreshLeft } from '@element-plus/icons-vue';

const props = defineProps<{
  modelValue: string;
  defaultAccelerator: string;
}>();

const emit = defineEmits<{
  (e: 'update:modelValue', value: string): void;
}>();

const recording = ref(false);
const currentKeys = ref<string[]>([]);
const displayAccelerator = ref(props.modelValue || '');

const keyMap: Record<string, string> = {
  'Control': 'Ctrl',
  'Meta': 'Cmd',
  'Alt': 'Alt',
  'Shift': 'Shift'
};

function startRecording(): void {
  recording.value = true;
  currentKeys.value = [];
}

function stopRecording(): void {
  recording.value = false;
}

function handleKeyDown(e: KeyboardEvent): void {
  if (!recording.value) return;
  e.preventDefault();
  e.stopPropagation();
  
  const key = normalizeKey(e.key);
  if (!currentKeys.value.includes(key)) {
    currentKeys.value.push(key);
  }
  updateDisplay();
}

function handleKeyUp(e: KeyboardEvent): void {
  if (!recording.value) return;
  e.preventDefault();
  e.stopPropagation();
  
  if (currentKeys.value.length > 0) {
    const accelerator = currentKeys.value.join('+');
    emit('update:modelValue', accelerator);
    displayAccelerator.value = accelerator;
  }
  recording.value = false;
}

function normalizeKey(key: string): string {
  return keyMap[key] || key.toUpperCase();
}

function updateDisplay(): void {
  displayAccelerator.value = currentKeys.value.join('+');
}

function reset(): void {
  emit('update:modelValue', props.defaultAccelerator);
  displayAccelerator.value = props.defaultAccelerator;
}

watch(() => props.modelValue, (newValue) => {
  displayAccelerator.value = newValue || '';
});
</script>

<style lang="scss" scoped>
.shortcut-recorder {
  width: 100%;
}
</style>