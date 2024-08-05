<template>
  <div class="file-upload">
    <h2>文件分片上传</h2>
    <input type="file" @change="handleFileChange" />
    <button @click="uploadChunks">上传</button>
    <!-- 显示进度 -->
    <div v-if="progress !== null" class="progress-container">
      <progress :value="progress" max="100"></progress>
      <span>{{ progress }}%</span>
      <p>当前上传分片: {{ currentChunk + 1 }} / {{ totalChunks }}</p>
    </div>
  </div>
</template>

<script setup>
import { ref } from "vue";
import axios from "axios";

const file = ref(null);
const chunkSize = ref(1024 * 1024); // 每片大小1MB
const progress = ref(null);
const uploadedChunks = ref([]);
const currentChunk = ref(0); // 当前分片索引
const totalChunks = ref(0); // 总分片数量
const uniqueId = ref(""); // 用于存储文件的唯一ID

// 假设这里有用户信息，比如用户ID
// 这个是非常重要的，就是用户的唯一标识符，用于标识用户上传的文件，因为用户可能上传相同的文件，
// 之前尝试过使用uuid和hash作为唯一标识符，uuid的做法会导致断点续传的功能失效，hash的做法会导致用户上传相同文件时获取其他用户上传的文件进度
const userId = "user234"; // 这应该来自你的用户认证系统

// 处理文件选择
const handleFileChange = (e) => {
  console.log("文件改变", e.target.files[0]);
  file.value = e.target.files[0];

  // 创建唯一标识符
  uniqueId.value = `${userId}-${file.value.name}`; // 组合成唯一ID
};

// 获取已上传的分片
const fetchUploadedChunks = async () => {
  if (!file.value) return;
  try {
    const response = await axios.get(`/api/upload-status/${uniqueId.value}`);
    uploadedChunks.value = response.data.uploadedChunks;
  } catch (error) {
    console.error("获取上传状态失败", error);
  }
};

// 上传文件切片
const uploadChunks = async () => {
  if (!file.value) {
    console.log("请先选择文件");
    return;
  }

  // 获取文件的总大小
  const totalSize = file.value.size;
  // 计算文件需要分片的总数
  totalChunks.value = Math.ceil(totalSize / chunkSize.value);
  // 初始化当前分片索引
  currentChunk.value = 0;

  // 获取已上传分片
  await fetchUploadedChunks();

  // 循环上传每一片
  while (currentChunk.value < totalChunks.value) {
    // 如果当前分片已上传，则跳过
    if (uploadedChunks.value.includes(currentChunk.value)) {
      currentChunk.value++;
      continue;
    }

    const start = currentChunk.value * chunkSize.value;
    const end = Math.min(totalSize, start + chunkSize.value);
    const chunk = file.value.slice(start, end);

    const formData = new FormData();
    formData.append("file", chunk); // 上传分片
    formData.append("chunkIndex", currentChunk.value); // 当前分片索引
    formData.append("totalChunks", totalChunks.value); // 总分片数
    formData.append("filename", file.value.name); // 文件名
    formData.append("fileSize", totalSize); // 文件大小
    formData.append("uniqueId", uniqueId.value); // 使用固定的唯一标识符

    try {
      const res = await axios.post("/api/upload", formData, {
        headers: {
          "Content-Type": "multipart/form-data",
        },
        onUploadProgress: (e) => {
          // 更新进度，使用相对值计算
          progress.value = Math.round(
            ((currentChunk.value + e.loaded / e.total) / totalChunks.value) *
              100
          );
        },
      });

      console.log("上传成功", res.data);
    } catch (error) {
      console.error("上传失败", error);
      break; // 出现错误时停止上传
    }

    currentChunk.value++;
  }

  // 上传完成后重置进度
  progress.value = null;
};
</script>

<style scoped>
.file-upload {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 20px;
  border: 1px solid #ccc;
  border-radius: 8px;
  background-color: #f9f9f9;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
  width: 300px;
  margin: auto;
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

  p {
    margin-top: 5px;
    font-weight: 600;
  }
}
</style>
