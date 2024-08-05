<template>
  <div class="file-upload">
    <h2>文件分片上传</h2>
    <input type="file" @change="handleFileChange" />
    <button @click="uploadChunks">上传</button>
    <!-- 显示进度 -->
    <div v-if="progress !== null" class="progress-container">
      <progress :value="progress" max="100"></progress>
      <span>{{ progress }}%</span>
    </div>
  </div>
</template>

<script setup>
import { ref } from "vue";
import axios from "axios";
import SparkMD5 from "spark-md5"; // 导入 MD5 库

const file = ref(null);
const chunkSize = ref(1024 * 1024); // 每片大小1MB
const progress = ref(null);
const uploadedChunks = ref([]);

// 处理文件选择
const handleFileChange = (e) => {
  console.log("文件改变", e.target.files[0]);
  file.value = e.target.files[0];
};

// 获取已上传的分片
const fetchUploadedChunks = async () => {
  if (!file.value) return;
  try {
    const response = await axios.get(`/api/upload-status/${file.value.name}`);
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
  const totalChunks = Math.ceil(totalSize / chunkSize.value);
  // 初始化当前分片索引
  let currentChunk = 0;

  // 获取已上传分片
  await fetchUploadedChunks();

  // 循环上传每一片
  while (currentChunk < totalChunks) {
    // 如果当前分片已上传，则跳过
    if (uploadedChunks.value.includes(currentChunk)) {
      currentChunk++;
      continue;
    }

    const start = currentChunk * chunkSize.value;
    const end = Math.min(totalSize, start + chunkSize.value);
    const chunk = file.value.slice(start, end);

    // 计算当前分片的 MD5 值
    const spark = new SparkMD5.ArrayBuffer();
    const reader = new FileReader();

    const md5Promise = new Promise((resolve, reject) => {
      reader.onload = (e) => {
        spark.append(e.target.result); // 追加读取的分片数据
        resolve(spark.end()); // 返回 MD5 值
      };

      reader.onerror = (err) => {
        reject(err); // 处理错误
      };

      reader.readAsArrayBuffer(chunk); // 读取分片为 ArrayBuffer 以进行 MD5 计算
    });

    const md5Hash = await md5Promise; // 等待 MD5 计算完成

    const formData = new FormData();
    formData.append("file", chunk); // 上传分片
    formData.append("chunkIndex", currentChunk); // 当前分片索引
    formData.append("totalChunks", totalChunks); // 总分片数
    formData.append("filename", file.value.name); // 文件名
    formData.append("fileSize", totalSize); // 文件大小
    formData.append("md5", md5Hash); // 添加 MD5 值

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
}
</style>
