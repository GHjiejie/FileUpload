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

// 状态管理
const file = ref(null);
const chunkSize = ref(0); // 分片大小
const progress = ref(null);
const uploadedChunks = ref([]);
const currentChunk = ref(0); // 当前分片索引
const totalChunks = ref(0); // 总分片数量
const uniqueId = ref(""); // 用于存储文件的唯一ID

const userId = "user234"; // 用户唯一标识符

// 处理文件选择
const handleFileChange = (e) => {
  console.log("文件改变", e.target.files[0]);
  file.value = e.target.files[0];

  // 创建唯一标识符
  uniqueId.value = `${userId}-${file.value.name}`; // 组合成唯一ID
};

// 动态计算分片大小
const calculateChunkSize = (fileSize) => {
  if (fileSize < 10 * 1024 * 1024) { // 小于 10MB
    return 512 * 1024; // 512KB
  } else if (fileSize < 100 * 1024 * 1024) { // 10MB 到 100MB
    return 1 * 1024 * 1024; // 1MB
  } else { // 大于 100MB
    return 2 * 1024 * 1024; // 2MB
  }
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

  const totalSize = file.value.size;
  chunkSize.value = calculateChunkSize(totalSize); // 动态设置分片大小
  totalChunks.value = Math.ceil(totalSize / chunkSize.value); // 计算总分片数
  currentChunk.value = 0; // 初始化当前分片索引

  // 获取已上传的分片
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
            ((currentChunk.value + e.loaded / e.total) / totalChunks.value) * 100
          );
        },
      });

      console.log("上传成功", res.data);
    } catch (error) {
      console.error("上传失败", error);
      break; // 出现错误时停止上传
    }

    currentChunk.value++; // 处理下一个分片
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
  padding: 30px;
  border: 1px solid #ddd;
  border-radius: 12px;
  background-color: #ffffff;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.1);
  width: 400px;
  margin: auto;
  transition: box-shadow 0.3s ease;
}

.file-upload:hover {
  box-shadow: 0 6px 30px rgba(0, 0, 0, 0.2);
}

h2 {
  color: #333;
  font-size: 24px;
  margin-bottom: 20px;
}

input[type="file"] {
  margin-bottom: 15px;
  padding: 8px;
  border: 1px solid #ccc;
  border-radius: 4px;
  width: 100%;
  font-size: 16px;
  transition: border-color 0.3s ease;
}

input[type="file"]:hover {
  border-color: #007bff;
}

button {
  padding: 10px 20px;
  border: none;
  border-radius: 4px;
  background-color: #007bff;
  color: white;
  font-size: 18px;
  cursor: pointer;
  transition: background-color 0.3s ease;
}

button:hover {
  background-color: #0056b3;
}

.progress-container {
  margin-top: 20px;
  width: 100%;
  text-align: center;
}

progress {
  width: 100%;
  height: 25px;
  border-radius: 5px;
  background-color: #f3f3f3;
}

span {
  margin-left: 10px;
  font-weight: bold;
  color: #333;
}

p {
  margin-top: 5px;
  font-weight: 600;
  color: #666;
}
</style>
