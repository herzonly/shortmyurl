const express = require('express');
const bodyParser = require('body-parser');
const mongoose = require('mongoose');
const requestIP = require('request-ip');

const app = express();
const port = 3000;
const baseUrl = 'shortmyurl.us.kg';

mongoose.connect('mongodb+srv://herza:herza@cluster0.stvrg.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0', {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});
const db = mongoose.connection;
db.on('error', console.error.bind(console, 'Koneksi database gagal:'));
db.once('open', () => {
  console.log('Koneksi database berhasil');
});

// Schema dan model MongoDB
const UrlSchema = new mongoose.Schema({
  name: { type: String, required: true, unique: true },
  web_target: { type: String, required: true },
  web_url: { type: String, required: true },
  created_at: { type: Date, default: Date.now },
  created_by_ip: { type: String },
  visits: { type: Number, default: 0 },
  visit_history: [
    {
      ip: { type: String },
      timestamp: { type: Date, default: Date.now },
    },
  ],
});
const Url = mongoose.model('Url', UrlSchema);

// Middleware
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(express.static('public'));
app.use(requestIP.mw());

// Helper untuk validasi URL
function isValidUrl(string) {
  try {
    new URL(string);
    return true;
  } catch (_) {
    return false;
  }
}

// Route untuk membuat URL pendek
app.post('/shorten', async (req, res) => {
  try {
    const { url, name } = req.body;
    const clientIP = req.clientIp;

    if (!url || !name) {
      return res.status(400).json({
        success: false,
        message: 'URL dan nama tidak boleh kosong!',
        alertType: 'danger',
      });
    }

    if (!isValidUrl(url)) {
      return res.status(400).json({
        success: false,
        message: 'Format URL tidak valid!',
        alertType: 'danger',
      });
    }

    if (!/^[a-zA-Z0-9-]+$/.test(name)) {
      return res.status(400).json({
        success: false,
        message: 'Nama URL hanya boleh mengandung huruf, angka, dan dash (-)!',
        alertType: 'danger',
      });
    }

    const existingUrl = await Url.findOne({ name });
    if (existingUrl) {
      return res.status(400).json({
        success: false,
        message: 'Nama URL pendek sudah digunakan! Silakan pilih nama lain.',
        alertType: 'danger',
      });
    }

    const newUrl = new Url({
      name,
      web_target: url,
      web_url: `${baseUrl}/${name}`,
      created_by_ip: clientIP,
    });

    await newUrl.save();

    res.json({
      success: true,
      message: 'URL pendek berhasil dibuat!',
      alertType: 'success',
      data: newUrl,
    });
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({
      success: false,
      message: 'Terjadi kesalahan server',
      alertType: 'danger',
    });
  }
});

// Route untuk redirect URL pendek
app.get('/:name', async (req, res) => {
  try {
    const { name } = req.params;
    const clientIP = req.clientIp;

    const urlData = await Url.findOne({ name });
    if (!urlData) {
      return res.status(404).json({
        success: false,
        message: 'URL tidak ditemukan',
        alertType: 'danger',
      });
    }

    urlData.visits += 1;
    urlData.visit_history.push({ ip: clientIP });
    await urlData.save();

    res.redirect(urlData.web_target);
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({
      success: false,
      message: 'Terjadi kesalahan server',
      alertType: 'danger',
    });
  }
});

// Route untuk mendapatkan statistik URL
app.get('/api/stats/:name', async (req, res) => {
  try {
    const { name } = req.params;

    const urlData = await Url.findOne({ name });
    if (!urlData) {
      return res.status(404).json({
        success: false,
        message: 'URL tidak ditemukan',
        alertType: 'danger',
      });
    }

    res.json({
      success: true,
      data: urlData,
    });
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({
      success: false,
      message: 'Terjadi kesalahan server',
      alertType: 'danger',
    });
  }
});

// Start server
app.listen(port, () => {
  console.log(`Server berjalan di http://localhost:${port}`);
});

module.exports = app
