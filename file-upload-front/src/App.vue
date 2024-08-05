<template>
  <div class="file-upload">
    <input type="file" @change="handleFileChange" />
    <button @click="uploadChunks">上传</button>
    <!-- 显示进度： -->
    <div v-if="progress !== null" class="progress-container">
      <progress :value="progress" max="100"></progress>
      <span>{{ progress }}%</span>
    </div>
  </div>
</template>

<script setup>
import { ref } from "vue";
import axios from "axios";

const file = ref(null);
const chunkSize = ref(1024 * 1024); // 每片大小1MB
const progress = ref(null);

const handleFileChange = (e) => {
  console.log("文件改变", e.target.files[0]);
  file.value = e.target.files[0];
};

const uploadChunks = async () => {
  if (!file.value) {
    console.log("请先选择文件");
    return;
  }

  // 获取文件的总大小
  const totalSize = file.value.size;
  // 计算文件需要分片的总数
  const totalChunks = Math.ceil(totalSize / chunkSize.value);
  // 初始化当前分片索引
  let currentChunk = 0;

  // 循环上传每一片
  while (currentChunk < totalChunks) {
    const start = currentChunk * chunkSize.value;
    const end = Math.min(totalSize, start + chunkSize.value);
    const chunk = file.value.slice(start, end);

    const formData = new FormData();
    formData.append("file", chunk); // 上传分片
    formData.append("chunkIndex", currentChunk); // 当前分片索引
    formData.append("totalChunks", totalChunks); // 总分片数
    formData.append("filename", file.value.name); // 文件名

    try {
      const res = await axios.post("/api/upload", formData, {
        headers: {
          "Content-Type": "multipart/form-data",
        },
        onUploadProgress: (e) => {
          // 更新进度，使用相对值计算
          progress.value = Math.round(
            ((currentChunk + e.loaded / e.total) / totalChunks) * 100
          );
        },
      });

      console.log("上传成功", res.data);
    } catch (error) {
      console.error("上传失败", error);
      break; // 出现错误时停止上传
    }

    currentChunk++;
  }

  // 上传完成后重置进度
  progress.value = null;
};
</script>

<style lang="scss" scoped>
.file-upload {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 20px;
  border: 1px solid #ccc;
  border-radius: 8px;
  background-color: #f9f9f9;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);

  input[type="file"] {
    margin-bottom: 10px;
    padding: 5px;
    border: 1px solid #007bff;
    border-radius: 4px;
    outline: none;
    transition: border-color 0.3s;

    &:hover {
      border-color: #0056b3;
    }
  }

  button {
    padding: 10px 15px;
    color: white;
    background-color: #007bff;
    border: none;
    border-radius: 4px;
    cursor: pointer;
    transition: background-color 0.3s;

    &:hover {
      background-color: #0056b3;
    }
  }

  .progress-container {
    margin-top: 10px;
    width: 100%;
    text-align: center;

    progress {
      width: 100%;
      height: 20px;
      border-radius: 10px;
    }

    span {
      margin-left: 10px;
      font-weight: bold;
    }
  }
}
</style>
