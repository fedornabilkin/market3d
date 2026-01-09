import OrderFile from '../models/OrderFile.js';
import Order from '../models/Order.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const uploadOrderFiles = async (req, res) => {
  try {
    const orderId = parseInt(req.params.orderId);
    
    // Проверяем существование заказа и права доступа
    const order = await Order.findById(orderId);
    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }

    // Только владелец заказа может загружать файлы
    if (order.userId !== req.user.id) {
      return res.status(403).json({ error: 'Forbidden: You can only upload files to your own orders' });
    }

    // Можно загружать файлы только для черновиков
    if (order.state !== 'draft') {
      return res.status(400).json({ error: 'Files can only be uploaded to draft orders' });
    }

    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ error: 'No files uploaded' });
    }

    // Проверяем количество существующих файлов
    const existingFiles = await OrderFile.findByOrderId(orderId);
    const totalFiles = existingFiles.length + req.files.length;
    
    if (totalFiles > 10) {
      return res.status(400).json({ 
        error: `Maximum 10 files allowed. You already have ${existingFiles.length} files.` 
      });
    }

    // Валидация форматов и размеров файлов
    const allowedExtensions = ['.stl', '.obj', '.3mf'];
    const maxFileSize = 50 * 1024 * 1024; // 50MB

    for (const file of req.files) {
      const ext = path.extname(file.originalname).toLowerCase();
      if (!allowedExtensions.includes(ext)) {
        return res.status(400).json({ 
          error: `Invalid file type: ${file.originalname}. Allowed formats: .stl, .obj, .3mf` 
        });
      }
      
      if (file.size > maxFileSize) {
        return res.status(400).json({ 
          error: `File too large: ${file.originalname}. Maximum size: 50MB` 
        });
      }
    }

    const uploadedFiles = [];

    for (const file of req.files) {
      const fileUrl = `/uploads/${file.filename}`;
      
      const orderFile = await OrderFile.create({
        orderId,
        fileUrl,
        fileName: file.originalname,
        fileSize: file.size,
        fileType: file.mimetype,
      });

      uploadedFiles.push(orderFile);
    }

    res.status(201).json({
      message: 'Files uploaded successfully',
      files: uploadedFiles,
    });
  } catch (error) {
    console.error('Upload files error:', error);
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
};

export const getOrderFiles = async (req, res) => {
  try {
    const orderId = parseInt(req.params.orderId);
    
    // Проверяем существование заказа и права доступа
    const order = await Order.findById(orderId);
    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }

    // Проверяем права: автор заказа всегда может видеть файлы
    // Автор кластера может видеть файлы, если заказ в статусе in_progress
    const isOrderAuthor = order.userId === req.user.id;
    const isClusterOwner = order.clusterOwnerId === req.user.id;
    const canViewFiles = isOrderAuthor || (isClusterOwner && order.state === 'in_progress');

    if (!canViewFiles) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    const files = await OrderFile.findByOrderId(orderId);
    res.json(files);
  } catch (error) {
    console.error('Get order files error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const downloadOrderFile = async (req, res) => {
  try {
    const { orderId, fileId } = req.params;
    
    // Проверяем существование заказа
    const order = await Order.findById(orderId);
    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }

    // Проверяем права: автор заказа всегда может скачивать
    // Автор кластера может скачивать, если заказ в статусе in_progress
    const isOrderAuthor = order.userId === req.user.id;
    const isClusterOwner = order.clusterOwnerId === req.user.id;
    const canDownload = isOrderAuthor || (isClusterOwner && order.state === 'in_progress');

    if (!canDownload) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    const file = await OrderFile.findById(fileId);
    if (!file || file.orderId !== parseInt(orderId)) {
      return res.status(404).json({ error: 'File not found' });
    }

    const filePath = path.join(__dirname, '../../uploads', path.basename(file.fileUrl));
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: 'File not found on server' });
    }

    res.download(filePath, file.fileName);
  } catch (error) {
    console.error('Download file error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const deleteOrderFile = async (req, res) => {
  try {
    const { orderId, fileId } = req.params;
    
    // Проверяем существование заказа и права доступа
    const order = await Order.findById(orderId);
    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }

    // Только владелец заказа может удалять файлы
    if (order.userId !== req.user.id) {
      return res.status(403).json({ error: 'Forbidden: You can only delete files from your own orders' });
    }

    // Можно удалять файлы только из черновиков
    if (order.state !== 'draft') {
      return res.status(400).json({ error: 'Files can only be deleted from draft orders' });
    }

    const file = await OrderFile.findById(fileId);
    if (!file || file.orderId !== parseInt(orderId)) {
      return res.status(404).json({ error: 'File not found' });
    }

    // Удаляем файл с диска
    const filePath = path.join(__dirname, '../../uploads', path.basename(file.fileUrl));
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }

    const deleted = await OrderFile.delete(fileId, orderId);
    if (!deleted) {
      return res.status(404).json({ error: 'File not found' });
    }

    res.json({ message: 'File deleted successfully' });
  } catch (error) {
    console.error('Delete file error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

