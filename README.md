# berasak.ai

Platform pemantauan, analisis wilayah, artikel edukasi, dan prediksi harga beras harian di 6 provinsi Pulau Sulawesi (Sulawesi Utara, Sulawesi Tengah, Sulawesi Selatan, Sulawesi Tenggara, Gorontalo, dan Sulawesi Barat).

## Ringkasan Sistem

- **Sumber Data:** Pusat Informasi Harga Pangan Strategis (PIHPS) Bank Indonesia, mencakup 1.504 hari kalender (`2022-01-01` s/d `2026-02-12`) pada 3 saluran pasar: Pasar Modern, Pasar Tradisional, dan Tingkat Produsen.
- **Total Observasi:** 27.072 baris terverifikasi (`3 saluran x 6 provinsi x 1.504 tanggal`).
- **Mesin Prediksi:** Evaluasi deret waktu mingguan (jangka 4 minggu dan 8 minggu) menggunakan perbandingan 3 metode (Seasonal Naive, Moving Average 4W, dan ARIMA(1,1,0)) lengkap dengan rentang prediksi 90% serta metrik kesalahan (MAE dan MAPE).
- **Antarmuka Web Publik:** Didesain dengan gaya **Minimalism & Swiss Style**, tipografi `Plus Jakarta Sans` dan `JetBrains Mono`, mode terang/gelap terkalibrasi WCAG AA, header/navbar responsif, footer terstruktur, cek cepat harga & estimasi belanja keluarga, peta interaktif Sulawesi, artikel edukasi (`#artikel`), panduan & kamus istilah (`#panduan`), serta halaman kontak resmi (`#kontak`).
- **Kontak Layanan Pengguna:** `customer.service@berasak.ai.com` dan telepon `(6767) 6996697`.

## Rute Halaman Web

- `#beranda`: Cek cepat harga provinsi & kalkulator estimasi belanja beras, selisih antarprovinsi, peringkat 6 provinsi, dan artikel pilihan.
- `#tren`: Grafik tren historis harian, mingguan, dan bulanan beserta rata-rata bergerak 4 minggu.
- `#bandingkan`: Peringkat wilayah, peta interaktif Pulau Sulawesi, dan selisih harga produsen ke eceran.
- `#prakiraan`: Prediksi 4-8 minggu ke depan lengkap dengan rentang wajar 90% dan tabel akurasi metode.
- `#kualitas`: Transparansi hari tanpa pelaporan dan perubahan harian di atas 10%.
- `#unduh`: Pratinjau dan unduh dataset CSV (format memanjang atau melebar).
- `#artikel` & `#artikel/<slug>`: Daftar artikel edukasi publik dengan filter kategori dan pencarian.
- `#panduan`: Panduan 3 langkah, kamus istilah sederhana, dan FAQ publik.
- `#kontak`: Saluran layanan resmi dan penyusun draf pesan email tervalidasi.

## Struktur Direktori

```text
.
├── DESIGN.md                       # Spesifikasi sistem desain Minimalism & Swiss Style berasak.ai
├── anti-slop/
│   └── audit-001-2026-11-19.md     # Catatan riwayat audit desain dan kualitas kode awal
├── backend/
│   └── server.py                   # Server HTTP REST API + penyaji berkas statis
├── data/
│   ├── pantau_beras.db             # Basis data SQLite terindeks (observasi, statistik, proyeksi)
│   ├── processed/                  # Ekspor CSV format wide dan long per saluran pasar
│   ├── raw/archive.zip             # Arsip dataset mentah PIHPS
│   └── verified_figma_snapshot.json
├── pipeline/
│   ├── schema.sql                  # Skema tabel dan indeks SQLite
│   ├── etl.py                      # Pipeline ekstraksi, pembersihan, dan normalisasi data
│   └── forecast.py                 # Mesin proyeksi deret waktu dan evaluasi metrik
├── tests/
│   ├── test_pipeline.py            # Pengujian integritas ETL dan proyeksi
│   └── test_api.py                 # Pengujian endpoint REST API dan ekspor CSV
└── web/
    ├── index.html                  # Kerangka aplikasi web, header/navbar, drawer, dan footer
    ├── js/                         # Modul klien API, artikel edukasi, grafik SVG, peta Sulawesi, dan state
    └── styles/                     # Token tema, tata letak responsif, dan komponen Swiss Style
```

## Cara Menjalankan

Pastikan Python 3.10+ telah terpasang. Proyek ini menggunakan pustaka standar Python tanpa ketergantungan eksternal tambahan.

### 1. Menjalankan Pipeline ETL dan Proyeksi (Opsional, basis data sudah tersedia)

```bash
python3 pipeline/etl.py
python3 pipeline/forecast.py
```

### 2. Menjalankan Server Aplikasi dan API

```bash
PORT=8765 python3 backend/server.py
```

Buka `http://127.0.0.1:8765` di peramban untuk mengakses antarmuka **berasak.ai**.

### 3. Menjalankan Pengujian Otomatis

```bash
python3 -m unittest discover -s tests -v
```

## Endpoint REST API Utama

- `GET /api/health`: Status kesehatan server dan koneksi basis data.
- `GET /api/meta`: Metadata cakupan tanggal, daftar provinsi, dan ringkasan eksekusi ETL.
- `GET /api/overview?segment=modern`: Ringkasan harga regional, disparitas provinsi, dan tren 90 hari terakhir.
- `GET /api/trends?segment=modern&provinces=Sulawesi+Tengah&agg=monthly&range=1y`: Deret waktu historis harian, mingguan, atau bulanan.
- `GET /api/compare?segment=modern&date=YYYY-MM-DD`: Perbandingan harga dan selisih margin antara Tingkat Produsen, Pasar Tradisional, dan Pasar Modern.
- `GET /api/forecasts?segment=modern&province=Sulawesi+Tengah&horizon=4&model=arima_110`: Prediksi harga mingguan beserta evaluasi MAE dan MAPE ketiga metode.
- `GET /api/quality?segment=modern&province=all`: Ringkasan hari tanpa laporan dan deteksi lonjakan harga harian >10%.
- `GET /api/export?segment=modern&provinces=all&shape=long&preview=0`: Pratinjau JSON dan unduh data terfilter dalam format CSV.
