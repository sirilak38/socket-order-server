const express = require('express');
const http = require('http');
const cors = require('cors');
const { Server } = require('socket.io');
const { v4: uuidv4 } = require('uuid');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: '*' }
});

app.use(cors());
app.use(express.json());
app.use(express.static('public')); // เสิร์ฟไฟล์ HTML จากโฟลเดอร์ public

let orders = [];        // เก็บออร์เดอร์ทั้งหมด
let queueNumber = 1;    // เริ่มต้นเลขคิว

// 🧮 ฟังก์ชันคำนวณคิวที่เหลือ
function calculateRemainingQueue(currentOrder) {
  return orders.filter(o => o.status !== 'delivered' && o.queueNumber < currentOrder.queueNumber).length;
}

// 📦 รับออร์เดอร์จากลูกค้า
app.post('/order', (req, res) => {
  const { table, items } = req.body;

  if (!table || !items || items.length === 0) {
    return res.status(400).json({ error: 'ข้อมูลไม่ครบ' });
  }

  const orderTime = new Date().toLocaleString(); // เวลาในการสั่ง
  const newOrder = {
    id: uuidv4(),
    table,
    items,
    status: 'waiting',
    queueNumber: queueNumber++,
    orderTime
  };

  orders.push(newOrder);

  // แจ้งพ่อครัวว่ามีออร์เดอร์ใหม่
  io.emit('new-order', newOrder);

  res.json({ id: newOrder.id, queueNumber: newOrder.queueNumber, remainingQueue: queueNumber - 1 });
});

// 🍳 พ่อครัวอัปเดตสถานะออร์เดอร์
app.post('/order/:id/status', (req, res) => {
  const { id } = req.params;
  const { status } = req.body;

  const order = orders.find(o => o.id === id);
  if (!order) return res.status(404).json({ error: 'ไม่พบออร์เดอร์' });

  order.status = status;

  if (status === 'delivered') {
    queueNumber--;
  }

  io.emit('status-updated', {
    order: order,  // ส่งข้อมูลออร์เดอร์ทั้งหมดไป
    remainingQueue: calculateRemainingQueue(order)
  });
  

  res.json({ message: 'อัปเดตแล้ว', order });
});

// 🌐 หน้าเว็บลูกค้า
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'customer.html'));
});

// 🍽️ หน้าเว็บพ่อครัว
app.get('/chef', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'chef.html'));
});

// 🔥 เริ่มรันเซิร์ฟเวอร์
server.listen(3000, () => {
  console.log('🚀 Server is running at http://localhost:3000');
});
