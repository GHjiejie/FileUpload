const express = require("express");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const crypto = require("crypto"); // 用于生成 MD5
const router = express.Router();

const uploadDir = path.join(__dirname, "../public/upload");
const tempDir = path.join(uploadDir, "temp"); // 临时存储目录

// 判断文件夹是否存在，不存在则创建
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// 创建临时文件夹
if (!fs.existsSync(tempDir)) {
  fs.mkdirSync(tempDir, { recursive: true });
}

// 配置 multer 中间件
const storage = multer.memoryStorage(); // 使用内存存储
const upload = multer({ storage: storage });

// 用于存储上传状态的 JSON 文件路径
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
  const { chunkIndex, totalChunks, filename, fileSize, md5 } = req.body;

  if (!req.file) {
    return res.status(400).send("没有文件上传");
  }

  // 构造文件路径
  const chunkPath = path.join(tempDir, `${filename}.chunk-${chunkIndex}`);

  // 如果上传文件的 MD5 不匹配，返回错误
  const hash = crypto.createHash("md5");
  hash.update(req.file.buffer);
  const calculatedMd5 = hash.digest("hex");

  if (calculatedMd5 !== md5) {
    return res.status(400).send("MD5 校验失败，文件可能损坏");
  }

  // 保存分片到指定路径
  fs.writeFile(chunkPath, req.file.buffer, (err) => {
    if (err) {
      console.error("写入分片失败:", err);
      return res.status(500).send("分片上传失败");
    }

    console.log(`分片 ${chunkIndex} 上传成功`);

    // 更新上传状态
    updateUploadStatus(filename, chunkIndex, fileSize);

    // 检查是否是最后一个分片
    if (parseInt(chunkIndex) === parseInt(totalChunks) - 1) {
      console.log("所有分片上传完成");
      mergeChunks(filename, totalChunks); // 合并分片
    }

    return res.status(200).send("分片上传成功");
  });
});

// 更新上传状态
function updateUploadStatus(filename, chunkIndex, fileSize) {
  const status = JSON.parse(fs.readFileSync(uploadStatusFile));

  // 如果该文件未被记录，则初始化
  if (!status[filename]) {
    status[filename] = {
      uploadedChunks: [],
      fileSize: fileSize,
    };
  }

  // 记录已上传的分片索引
  if (!status[filename].uploadedChunks.includes(parseInt(chunkIndex))) {
    status[filename].uploadedChunks.push(parseInt(chunkIndex));
  }

  fs.writeFileSync(uploadStatusFile, JSON.stringify(status));
}

// 获取上传状态
router.get("/upload-status/:filename", (req, res) => {
  const { filename } = req.params;
  console.log("获取上传状态", filename);
  const status = JSON.parse(fs.readFileSync(uploadStatusFile));
  const uploadedChunks = status[filename]
    ? status[filename].uploadedChunks
    : [];
  res.status(200).json({ uploadedChunks });
});

// 合并分片函数
function mergeChunks(filename, totalChunks) {
  const finalFilePath = path.join(uploadDir, filename);
  const writeStream = fs.createWriteStream(finalFilePath);

  let chunkCount = 0;

  function readChunk(i) {
    const chunkPath = path.join(tempDir, `${filename}.chunk-${i}`);
    const readStream = fs.createReadStream(chunkPath);

    readStream.pipe(writeStream, { end: false });

    readStream.on("end", () => {
      chunkCount++;
      fs.unlinkSync(chunkPath); // 删除已合并的分片文件
      if (chunkCount < totalChunks) {
        readChunk(chunkCount);
      } else {
        writeStream.end(); // 所有分片已合并
        console.log("所有分片合并完成");
      }
    });

    readStream.on("error", (err) => {
      console.error(`读取分片 ${i} 失败`, err);
    });
  }

  readChunk(0);
}

module.exports = router;
