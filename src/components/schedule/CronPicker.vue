<template>
  <div class="cron-picker">
    <div class="cron-tabs">
      <el-radio-group v-model="currentTab" size="small">
        <el-radio-button label="simple">常用周期</el-radio-button>
        <el-radio-button label="custom">高级自定义</el-radio-button>
        <el-radio-button label="manual">手动输入</el-radio-button>
      </el-radio-group>
    </div>
    
    <!-- 常用周期 -->
    <div v-if="currentTab === 'simple'" class="cron-simple">
      <div class="preset-list">
        <div 
          v-for="preset in presetCron" 
          :key="preset.value"
          class="preset-item"
          :class="{ active: currentCron === preset.value }"
          @click="selectPreset(preset)"
        >
          <div class="preset-name">{{ preset.name }}</div>
          <div class="preset-desc">{{ preset.desc }}</div>
        </div>
      </div>
    </div>
    
    <!-- 高级自定义 -->
    <div v-if="currentTab === 'custom'" class="cron-custom">
      <el-form :model="customCron" label-width="60px" size="small">
        <el-form-item label="秒">
          <el-select v-model="customCron.second" placeholder="秒">
            <el-option label="每一秒" value="*" />
            <el-option label="0秒" value="0" />
            <el-option label="30秒" value="30" />
          </el-select>
        </el-form-item>
        <el-form-item label="分">
          <el-select v-model="customCron.minute" placeholder="分">
            <el-option label="每一分钟" value="*" />
            <el-option label="0分" value="0" />
            <el-option label="30分" value="30" />
          </el-select>
        </el-form-item>
        <el-form-item label="时">
          <el-select v-model="customCron.hour" placeholder="时">
            <el-option label="每一小时" value="*" />
            <el-option label="0点" value="0" />
            <el-option label="9点" value="9" />
            <el-option label="14点" value="14" />
            <el-option label="18点" value="18" />
          </el-select>
        </el-form-item>
        <el-form-item label="日">
          <el-select v-model="customCron.day" placeholder="日">
            <el-option label="每一天" value="*" />
            <el-option label="1号" value="1" />
            <el-option label="15号" value="15" />
          </el-select>
        </el-form-item>
        <el-form-item label="月">
          <el-select v-model="customCron.month" placeholder="月">
            <el-option label="每一月" value="*" />
            <el-option label="1月" value="1" />
            <el-option label="6月" value="6" />
            <el-option label="12月" value="12" />
          </el-select>
        </el-form-item>
        <el-form-item label="周">
          <el-select v-model="customCron.week" placeholder="周">
            <el-option label="不指定" value="?" />
            <el-option label="周一" value="1" />
            <el-option label="周五" value="5" />
          </el-select>
        </el-form-item>
      </el-form>
    </div>
    
    <!-- 手动输入 -->
    <div v-if="currentTab === 'manual'" class="cron-manual">
      <el-input 
        v-model="manualCron" 
        placeholder="请输入 Cron 表达式（例如：0 9 * * *）"
        @input="validateCron"
      />
      <div v-if="cronError" class="cron-error">{{ cronError }}</div>
    </div>
    
    <div class="cron-result">
      <div class="cron-expression">
        <span class="label">Cron 表达式：</span>
        <span class="value">{{ currentCron }}</span>
      </div>
      <div class="cron-desc">
        <span class="label">表达式释义：</span>
        <span class="value">{{ currentCronDesc }}</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue';

interface PresetCron {
  name: string;
  desc: string;
  value: string;
}

interface CustomCron {
  second: string;
  minute: string;
  hour: string;
  day: string;
  month: string;
  week: string;
}

const props = defineProps<{
  modelValue: string;
}>();

const emit = defineEmits<{
  (e: 'update:modelValue', value: string): void;
}>();

const currentTab = ref<'simple' | 'custom' | 'manual'>('simple');
const manualCron = ref(props.modelValue || '');
const cronError = ref('');

const presetCron: PresetCron[] = [
  { name: '每分钟', desc: '每一分钟执行一次', value: '* * * * *' },
  { name: '每小时', desc: '每小时整点执行一次', value: '0 * * * *' },
  { name: '每天', desc: '每天 09:00 执行', value: '0 9 * * *' },
  { name: '每周一', desc: '每周一 09:00 执行', value: '0 9 * * 1' },
  { name: '每月1号', desc: '每月1号 10:00 执行', value: '0 10 1 * *' },
  { name: '每天凌晨', desc: '每天凌晨 02:00 执行', value: '0 2 * * *' }
];

const customCron = reactive<CustomCron>({
  second: '0',
  minute: '0',
  hour: '9',
  day: '*',
  month: '*',
  week: '?'
});

const currentCron = computed(() => {
  if (currentTab.value === 'simple') {
    return manualCron.value;
  } else if (currentTab.value === 'custom') {
    return `${customCron.second} ${customCron.minute} ${customCron.hour} ${customCron.day} ${customCron.month} ${customCron.week}`;
  } else {
    return manualCron.value;
  }
});

const currentCronDesc = computed(() => {
  const preset = presetCron.find(p => p.value === currentCron.value);
  if (preset) return preset.desc;
  return '自定义执行周期';
});

function selectPreset(preset: PresetCron): void {
  manualCron.value = preset.value;
  emit('update:modelValue', preset.value);
}

function validateCron(): void {
  if (!manualCron.value) {
    cronError.value = '请输入 Cron 表达式';
    return;
  }
  const cronRegex = /^(\*|\d+|\d+-\d+|\d+\/\d+)(\s+(\*|\d+|\d+-\d+|\d+\/\d+)){4,5}$/;
  if (!cronRegex.test(manualCron.value)) {
    cronError.value = 'Cron 表达式格式错误';
  } else {
    cronError.value = '';
    emit('update:modelValue', manualCron.value);
  }
}

watch(() => props.modelValue, (newVal) => {
  if (newVal) {
    manualCron.value = newVal;
  }
}, { immediate: true });

watch(currentCron, (newVal) => {
  emit('update:modelValue', newVal);
});
</script>

<style lang="scss" scoped>
.cron-picker {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.cron-tabs {
  display: flex;
  justify-content: center;
}

.cron-simple {
  .preset-list {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 12px;
  }
  
  .preset-item {
    padding: 16px;
    border: 1px solid var(--border-color);
    border-radius: 8px;
    cursor: pointer;
    transition: all 0.2s;
    
    &:hover {
      border-color: var(--el-color-primary);
      background-color: var(--el-color-primary-light-9);
    }
    
    &.active {
      border-color: var(--el-color-primary);
      background-color: var(--el-color-primary-light-9);
    }
  }
  
  .preset-name {
    font-weight: 600;
    margin-bottom: 4px;
    color: var(--text-color);
  }
  
  .preset-desc {
    font-size: 12px;
    color: var(--text-color-secondary);
  }
}

.cron-custom {
  .el-form-item {
    margin-bottom: 12px;
  }
}

.cron-manual {
  .cron-error {
    margin-top: 8px;
    color: var(--el-color-danger);
    font-size: 12px;
  }
}

.cron-result {
  padding: 12px;
  background-color: var(--bg-color-secondary);
  border-radius: 8px;
  
  .cron-expression,
  .cron-desc {
    display: flex;
    gap: 8px;
    margin-bottom: 8px;
    
    &:last-child {
      margin-bottom: 0;
    }
    
    .label {
      font-size: 12px;
      color: var(--text-color-secondary);
      flex-shrink: 0;
    }
    
    .value {
      font-size: 14px;
      font-family: 'Consolas', monospace;
      color: var(--el-color-primary);
    }
  }
}
</style>