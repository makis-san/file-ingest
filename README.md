# 🚀 File Ingest API (W.I.P)

[![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

## 🌟 Overview

**File Ingest API** is an open-source Node.js project that simplifies file copying from mass storage devices (e.g., USB drives) to a local directory. With robust device detection, file browsing, and configurable ingestion settings, it provides a seamless solution for managing file transfers in automated workflows.

This repository is inspired by and extends the functionality of [makis-san/file-ingest](https://github.com/makis-san/file-ingest).

---

## ✨ Features

- 🔍 **Device Management**: Detect and manage connected mass storage devices.
- 📂 **File Browsing**: Explore the directory structure of connected devices.
- 🔄 **Automated Ingestion**: Register devices for automatic file ingestion.
- 📊 **Progress Tracking**: Monitor file transfer progress in real-time.
- 🛠️ **Highly Configurable**: Adjust settings like concurrency and delay for optimized performance.
- 📲 **Telegram Integration**: Receive real-time notifications of progress and status.

---

## 🛠️ Prerequisites

- **Node.js**: Version 18 or higher.
- **NPM/Yarn**: A package manager is required.
- **TrueNAS** or Linux-based system: Tested NFS and SMB shares in various environments for compatibility.

---

## 📥 Installation

1. **Clone the repository**:
   ```bash
   git clone https://github.com/makis-san/file-ingest.git
   cd file-ingest
   ```



2. **Install dependencies**:

   ```bash
   npm install
   ```

3. **Configure environment variables**:
   Create a `.env` file in the project root with the following content:

   ```dotenv
   BOT_TOKEN=your_telegram_bot_token       # Telegram Bot API token
   TELEGRAM_CHAT_ID=your_telegram_chat_id # Telegram chat ID for notifications
   STORAGE_MOUNT_DELAY=5000               # Delay in milliseconds for device initialization
   MAX_CONCURRENCY=3                      # Maximum concurrent file transfers
   ```

4. **Build the project**:
   ```bash
   npm run build
   ```

---

## 🚀 Usage

1. **Start the API**:

   ```bash
   npm run dev
   ```

2. **Access the API** at `http://localhost:3000`.

---

## 🔗 API Endpoints

### 📍 **Devices**

#### ✅ `GET /api/devices/`

Retrieve a list of all connected storage devices.

- **Response**:
  ```json
  [
    {
      "serialNumber": "123456",
      "mountpoints": [{ "path": "/mnt/device1" }],
      "size": "32GB"
    }
  ]
  ```

#### ✅ `GET /api/devices/:serial`

Get details for a specific device by serial number.

- **Response**:
  ```json
  {
    "serialNumber": "123456",
    "mountpoints": [{ "path": "/mnt/device1" }],
    "size": "32GB"
  }
  ```

#### ✅ `GET /api/devices/:serial/browse`

Browse the root directory of a specific device.

- **Response**:
  ```json
  [
    { "name": "file1.txt", "isDirectory": false },
    { "name": "folder1", "isDirectory": true }
  ]
  ```

---

### 📍 **Ingestion**

#### ✅ `GET /api/ingestion/`

List all registered devices for ingestion.

- **Response**:
  ```json
  [
    {
      "id": "uuid",
      "serial": "123456",
      "copyOnAttach": true,
      "allowedExtensions": [".txt", ".jpg"],
      "copyTo": "/local/target/path",
      "createdAt": "2024-11-19T10:00:00.000Z",
      "updatedAt": "2024-11-19T10:00:00.000Z"
    }
  ]
  ```

#### ✅ `POST /api/ingestion/register`

Register a device for ingestion.

- **Request Body**:

  ```json
  {
    "serial": "123456",
    "copyOnAttach": true,
    "allowedExtensions": [".txt", ".jpg"],
    "copyTo": "/local/target/path"
  }
  ```

- **Response**:
  ```json
  {
    "message": "Successfully registered ingestion for device 123456",
    "data": {
      "id": "uuid",
      "serial": "123456",
      "copyOnAttach": true,
      "allowedExtensions": [".txt", ".jpg"],
      "copyTo": "/local/target/path",
      "createdAt": "2024-11-19T10:00:00.000Z",
      "updatedAt": "2024-11-19T10:00:00.000Z"
    }
  }
  ```

---

## 🧑‍💻 Development

### 🔍 Running Tests

- **Run all tests**:

  ```bash
  npm test
  ```

- **Watch mode**:

  ```bash
  npm run test:watch
  ```

- **Test coverage**:
  ```bash
  npm run test:coverage
  ```

---

## 🤝 Contributing

We ❤️ contributions! Here's how you can help:

1. Fork the repository.
2. Create a new branch for your feature/bugfix.
3. Submit a pull request with a clear description of your changes.

---

## 📜 License

This project is licensed under the **MIT License**. See the [LICENSE](LICENSE) file for more details.

---

🎉 **Start managing your file ingestion workflow with ease!** 🚀
````
