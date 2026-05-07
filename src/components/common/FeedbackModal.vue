<template>
  <el-dialog
    v-model="visible"
    title="提交反馈"
    width="500px"
  >
    <el-form :model="formData" label-width="100px">
      <el-form-item label="反馈类型">
        <el-select v-model="formData.type" placeholder="请选择反馈类型">
          <el-option label="Bug 反馈" value="bug" />
          <el-option label="功能需求" value="feature" />
          <el-option label="体验优化" value="improvement" />
          <el-option label="其他" value="other" />
        </el-select>
      </el-form-item>
      <el-form-item label="问题描述">
        <el-input
          v-model="formData.description"
          type="textarea"
          :rows="5"
          placeholder="请详细描述您的问题或建议"
        />
      </el-form-item>
      <el-form-item label="联系方式">
        <el-input
          v-model="formData.contact"
          placeholder="请留下您的联系方式（可选）"
        />
      </el-form-item>
    </el-form>
    <template #footer>
      <el-button @click="visible = false">取消</el-button>
      <el-button type="primary" @click="handleSubmit">提交</el-button>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import { ref, reactive, computed } from 'vue';
import { ElMessage } from 'element-plus';

interface FormData {
  type: string;
  description: string;
  contact: string;
}

const props = defineProps<{
  modelValue: boolean;
}>();

const emit = defineEmits<{
  (e: 'update:modelValue', value: boolean): void;
}>();

const visible = computed({
  get: () => props.modelValue,
  set: (val) => emit('update:modelValue', val)
});

const formData = reactive<FormData>({
  type: '',
  description: '',
  contact: ''
});

function resetForm(): void {
  Object.assign(formData, {
    type: '',
    description: '',
    contact: ''
  });
}

function handleSubmit(): void {
  if (!formData.type || !formData.description) {
    ElMessage.warning('请填写反馈类型和问题描述');
    return;
  }

  ElMessage.success('感谢您的反馈！我们会尽快处理');
  visible.value = false;
  resetForm();
}
</script>

<style lang="scss" scoped>
</style>