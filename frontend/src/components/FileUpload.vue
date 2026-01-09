<template lang="pug">
div.file-upload
  el-upload(
    v-if="canUpload"
    ref="uploadRef"
    :file-list="[]"
    :disabled="disabled"
    :on-remove="handleRemove"
    :http-request="handleUpload"
    :limit="maxFiles"
    :accept="allowedExtensions.join(',')"
    :before-upload="beforeUpload"
    drag
    multiple
  )
    el-icon.upload-icon
      UploadFilled
    .el-upload__text
      | Перетащите файлы сюда или 
      em нажмите для загрузки
    template(#tip)
      .el-upload__tip
        | Разрешены файлы: {{ allowedExtensions.join(', ') }}, максимум {{ maxFileSizeMB }}MB, до {{ maxFiles }} файлов
  
  div(v-if="files.length > 0" style="margin-top: 20px")
    h3 Загруженные файлы
    el-table(:data="files" style="width: 100%")
      el-table-column(prop="fileName" label="Имя файла")
      el-table-column(prop="fileSize" label="Размер")
        template(#default="{ row }")
          | {{ formatFileSize(row.fileSize) }}
      el-table-column(label="Действия")
        template(#default="{ row }")
          el-button(
            v-if="canDownload(row)"
            @click="handleDownload(row)"
            size="small"
            type="primary"
          ) Скачать
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { UploadFilled } from '@element-plus/icons-vue';
import type { UploadFile, UploadRequestOptions } from 'element-plus';
import api from '../services/api';

interface OrderFile {
  id: number;
  orderId: number;
  fileUrl: string;
  fileName: string;
  fileSize?: number;
  fileType?: string;
  createdAt: string;
}

interface Props {
  orderId: number;
  files: OrderFile[];
  canUpload: boolean;
  canDownloadFile: (file: OrderFile) => boolean;
  disabled?: boolean;
  maxFiles?: number;
  maxFileSizeMB?: number;
  allowedExtensions?: string[];
}

const props = withDefaults(defineProps<Props>(), {
  disabled: false,
  maxFiles: 10,
  maxFileSizeMB: 50,
  allowedExtensions: () => ['.stl', '.obj', '.3mf'],
});

const emit = defineEmits<{
  'file-uploaded': [];
  'file-removed': [];
}>();

const uploadRef = ref();

const formatFileSize = (bytes?: number): string => {
  if (!bytes) return 'Неизвестно';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
};

const beforeUpload = (file: File): boolean => {
  const ext = '.' + file.name.split('.').pop()?.toLowerCase();
  if (!props.allowedExtensions.includes(ext)) {
    ElMessage.error(`Недопустимый формат файла. Разрешены: ${props.allowedExtensions.join(', ')}`);
    return false;
  }
  
  const maxSize = props.maxFileSizeMB * 1024 * 1024;
  if (file.size > maxSize) {
    ElMessage.error(`Файл слишком большой. Максимальный размер: ${props.maxFileSizeMB}MB`);
    return false;
  }
  
  return true;
};

const handleUpload = async (options: UploadRequestOptions) => {
  try {
    const formData = new FormData();
    formData.append('files', options.file as File);
    
    await api.post(`/orders/${props.orderId}/files`, formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    
    ElMessage.success('Файл загружен успешно');
    emit('file-uploaded');
  } catch (error: any) {
    ElMessage.error(error.response?.data?.error || 'Ошибка при загрузке файла');
  }
};

const handleRemove = async (file: UploadFile) => {
  try {
    // Находим файл в списке по имени
    const orderFile = props.files.find(f => f.fileName === file.name);
    if (!orderFile) {
      ElMessage.error('Файл не найден');
      return;
    }
    await api.delete(`/orders/${props.orderId}/files/${orderFile.id}`);
    ElMessage.success('Файл удален');
    emit('file-removed');
  } catch (error: any) {
    ElMessage.error(error.response?.data?.error || 'Ошибка при удалении файла');
  }
};

const handleDownload = async (file: OrderFile) => {
  try {
    const response = await api.get(`/orders/${props.orderId}/files/${file.id}/download`, {
      responseType: 'blob',
    });
    
    const url = window.URL.createObjectURL(new Blob([response.data]));
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', file.fileName);
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(url);
  } catch (error: any) {
    ElMessage.error(error.response?.data?.error || 'Ошибка при скачивании файла');
  }
};

const canDownload = (file: OrderFile): boolean => {
  return props.canDownloadFile(file);
};
</script>

<script lang="ts">
import { ElMessage } from 'element-plus';
</script>

<style scoped>
.file-upload {
  width: 100%;
}
</style>
