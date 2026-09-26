#include <Arduino.h>
#include <SPI.h>
#include <EthernetENC.h>

// Definisi Pin SPI
#define W5500_CS   5
#define W5500_SCK  18
#define W5500_MISO 19
#define W5500_MOSI 23

// MAC Address (Bebas, asalkan unik)
byte mac[] = { 0xDE, 0xAD, 0xBE, 0xEF, 0xFE, 0xED };

// ==========================================
// KONFIGURASI IP STATIC (Sesuaikan dengan jaringan Anda)
// ==========================================
IPAddress ip(192, 168, 1, 200);      // IP Address untuk ESP32
IPAddress myDns(192, 168, 1, 1);     // IP DNS (Biasanya IP Router)
IPAddress gateway(192, 168, 1, 1);   // IP Gateway (Biasanya IP Router)
IPAddress subnet(255, 255, 255, 0);  // Subnet Mask

void setup() {
  Serial.begin(115200);
  while (!Serial) {
    ; // Tunggu Serial terhubung
  }
  
  Serial.println("\n--- Memulai Inisialisasi W5500 (IP Static) ---");

  // Inisialisasi bus SPI dengan pin khusus
  SPI.begin(W5500_SCK, W5500_MISO, W5500_MOSI, W5500_CS);
  
  // Beritahu library Ethernet untuk menggunakan pin CS yang dipilih
  Ethernet.init(W5500_CS);

  // Memulai koneksi Ethernet dengan IP Static
  Ethernet.begin(mac, ip, myDns, gateway, subnet);

  // Pengecekan status hardware W5500
  if (Ethernet.hardwareStatus() == EthernetNoHardware) {
    Serial.println("Modul W5500 tidak terdeteksi. Cek kabel MISO, MOSI, SCK, dan CS!");
    while (true) {
      delay(1);
    }
  } 
  
  if (Ethernet.linkStatus() == LinkOFF) {
    Serial.println("Kabel Ethernet tidak terhubung ke router/switch/laptop.");
  }

  // Cetak IP Address yang digunakan
  Serial.print("ESP32 Siap! IP Address: ");
  Serial.println(Ethernet.localIP());
  Serial.println("Silakan coba PING dari laptop Anda.");
}

void loop() {
  // Kosong. Tidak perlu Ethernet.maintain() karena tidak menggunakan DHCP.
}