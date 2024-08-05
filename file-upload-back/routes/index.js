const express = require("express");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const crypto = require("crypto"); // 用于生成 MD5
const router = express.Router();

const uploadDir = path.join(__dirname, "../public/upload");
const tempDir = path.join(uploadDir, "temp"); // 临时存储目录

// 确保上传目录和临时目录存在
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}
if (!fs.existsSync(tempDir)) {
  fs.mkdirSync(tempDir, { recursive: true });
}

// 配置 multer 中间件
const storage = multer.memoryStorage(); // 使用内存存储
const upload = multer({ storage: storage });

// 上传状态 JSON 文件路径
const uploadStatusFile = path.join(uploadDir, "uploadStatus.json");

// 初始化或读取上传状态
function initUploadStatus() {
  if (!fs.existsSync(uploadStatusFile)) {
    fs.writeFileSync(uploadStatusFile, JSON.stringify({}));
  }
}
initUploadStatus();

// 处理分片上传
router.post("/upload", upload.single("file"), (req, res) => {
  const { chunkIndex, totalChunks, filename, fileSize, uniqueId } = req.body;

  if (!req.file) {
    return res.status(400).send("没有文件上传");
  }

  // 构造分片文件路径
  const chunkPath = path.join(
    tempDir,
    `${uniqueId}.${filename}.chunk-${chunkIndex}`
  );

  // 保存分片到指定路径
  fs.writeFile(chunkPath, req.file.buffer, (err) => {
    if (err) {
      console.error("写入分片失败:", err);
      return res.status(500).send("分片上传失败");
    }

    console.log(`分片 ${chunkIndex} 上传成功`);

    // 更新上传状态
    updateUploadStatus(uniqueId, filename, chunkIndex, fileSize);

    // 检查是否是最后一个分片
    if (parseInt(chunkIndex) === parseInt(totalChunks) - 1) {
      console.log("所有分片上传完成");
      mergeChunks(uniqueId, filename, totalChunks); // 合并分片
    }

    return res.status(200).send("分片上传成功");
  });
});

// 更新上传状态
function updateUploadStatus(uniqueId, filename, chunkIndex, fileSize) {
  const status = JSON.parse(fs.readFileSync(uploadStatusFile));

  // 如果该文件未被记录，则初始化
  if (!status[uniqueId]) {
    status[uniqueId] = {
      filename: filename,
      uploadedChunks: [],
      fileSize: fileSize,
    };
  }

  // 记录已上传的分片索引
  if (!status[uniqueId].uploadedChunks.includes(parseInt(chunkIndex))) {
    status[uniqueId].uploadedChunks.push(parseInt(chunkIndex));
  }

  fs.writeFileSync(uploadStatusFile, JSON.stringify(status));
}

// 获取上传状态
router.get("/upload-status/:uniqueId", (req, res) => {
  const { uniqueId } = req.params;
  console.log("获取上传状态", uniqueId);
  const status = JSON.parse(fs.readFileSync(uploadStatusFile));
  const uploadedChunks = status[uniqueId]
    ? status[uniqueId].uploadedChunks
    : [];
  res.status(200).json({ uploadedChunks });
});

// 合并分片函数
function mergeChunks(uniqueId, filename, totalChunks) {
  const finalFilePath = path.join(uploadDir, filename);
  const writeStream = fs.createWriteStream(finalFilePath);

  let chunkCount = 0; // 已合并的分片数量

  function readChunk(i) {
    const chunkPath = path.join(tempDir, `${uniqueId}.${filename}.chunk-${i}`);

    // 判断分片文件是否存在
    if (!fs.existsSync(chunkPath)) {
      console.error(`分片文件不存在: ${chunkPath}`);
      return;
    }

    const readStream = fs.createReadStream(chunkPath);
    readStream.pipe(writeStream, { end: false });

    readStream.on("end", () => {
      chunkCount++;
      fs.unlinkSync(chunkPath); // 删除已合并的分片文件
      if (chunkCount < totalChunks) {
        readChunk(chunkCount); // 继续读取下一个分片
      } else {
        writeStream.end(); // 所有分片已合并
        console.log("所有分片合并完成");
      }
    });

    readStream.on("error", (err) => {
      console.error(`读取分片 ${i} 失败`, err);
    });
  }

  readChunk(0); // 开始读取第一个分片
}

module.exports = router;
