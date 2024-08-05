const express = require("express");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
var router = express.Router();

// 创建文件上传的路径
const uploadDir = path.join(__dirname, "../public/upload");

// 判断文件夹是否存在，不存在则创建
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// 配置multer中间件
const storage = multer.memoryStorage(); // 使用内存存储，方便处理分片
const upload = multer({ storage: storage });

// 处理分片上传
router.post("/upload", upload.single("file"), (req, res) => {
  const { chunkIndex, totalChunks, filename } = req.body;

  if (!req.file) {
    return res.status(400).send("没有文件上传");
  }

  // 将分片保存到 uploads 文件夹
  const chunkPath = path.join(uploadDir, `chunk-${chunkIndex}`);

  // 写入文件
  fs.writeFile(chunkPath, req.file.buffer, (err) => {
    if (err) {
      console.error("写入分片失败:", err);
      return res.status(500).send("分片上传失败");
    }

    console.log(`分片 ${chunkIndex} 上传成功`);

    // 检查是否是最后一个分片
    if (parseInt(chunkIndex) === parseInt(totalChunks) - 1) {
      console.log("所有分片上传完成");
      mergeChunks(totalChunks, filename); // 合并分片
    }

    return res.status(200).send("分片上传成功");
  });
});

// 合并分片函数
function mergeChunks(totalChunks, filename) {
  // 最终合并后的文件路径
  const finalFilePath = path.join(uploadDir, filename);

  const writeStream = fs.createWriteStream(finalFilePath);

  let chunkCount = 0;

  // 合并每个分片
  function readChunk(i) {
    const chunkPath = path.join(uploadDir, `chunk-${i}`);

    const readStream = fs.createReadStream(chunkPath);

    readStream.pipe(writeStream, { end: false });

    // 监听读取完成事件
    readStream.on("end", () => {
      chunkCount++;
      fs.unlinkSync(chunkPath); // 可选：删除已合并的分片文件
      if (chunkCount < totalChunks) {
        readChunk(chunkCount); // 递归读取下一个分片
      } else {
        writeStream.end(); // 所有分片已合并
        console.log("所有分片合并完成");
      }
    });
    // 监听读取失败事件
    readStream.on("error", (err) => {
      console.error(`读取分片 ${i} 失败`, err);
    });
  }

  readChunk(0); // 从第一个分片开始合并
}

module.exports = router;
