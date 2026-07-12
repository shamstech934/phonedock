import { db } from '../src/lib/db';
import { hash } from 'bcryptjs';

const BRANDS = [
  { name: 'Samsung', slug: 'samsung', country: 'South Korea', description: 'World\'s largest smartphone manufacturer known for Galaxy series', logo: '', sortOrder: 1 },
  { name: 'Apple', slug: 'apple', country: 'USA', description: 'Premium smartphones known for iPhone series with iOS ecosystem', logo: '', sortOrder: 2 },
  { name: 'Google', slug: 'google', country: 'USA', description: 'Pixel smartphones with pure Android experience and AI features', logo: '', sortOrder: 3 },
  { name: 'Xiaomi', slug: 'xiaomi', country: 'China', description: 'Value-for-money smartphones with MIUI/HyperOS', logo: '', sortOrder: 4 },
  { name: 'OnePlus', slug: 'oneplus', country: 'China', description: 'Flagship killer smartphones with OxygenOS', logo: '', sortOrder: 5 },
  { name: 'Vivo', slug: 'vivo', country: 'China', description: 'Camera-focused smartphones popular in South Asia', logo: '', sortOrder: 6 },
  { name: 'Oppo', slug: 'oppo', country: 'China', description: 'Innovative smartphones with fast charging technology', logo: '', sortOrder: 7 },
  { name: 'Realme', slug: 'realme', country: 'China', description: 'Budget-friendly smartphones with flagship features', logo: '', sortOrder: 8 },
  { name: 'Motorola', slug: 'motorola', country: 'USA', description: 'Classic brand with near-stock Android experience', logo: '', sortOrder: 9 },
  { name: 'Infinix', slug: 'infinix', country: 'China', description: 'Budget smartphones dominating the Pakistani market', logo: '', sortOrder: 10 },
  { name: 'Tecno', slug: 'tecno', country: 'China', description: 'Affordable smartphones with innovative features for emerging markets', logo: '', sortOrder: 11 },
  { name: 'Nothing', slug: 'nothing', country: 'UK', description: 'Unique design philosophy with transparent back and Glyph interface', logo: '', sortOrder: 12 },
];

const PHONES = [
  {
    brand: 'Apple', model: 'iPhone 15 Pro Max', slug: 'iphone-15-pro-max',
    releaseDate: '2023-09-22', pricePKR: 569999, ptaStatus: 'PTA Approved', ptaApproved: true,
    featured: true, trending: true, upcoming: false,
    thumbnail: 'https://fdn2.gsmarena.com/vv/bigpic/apple-iphone-15-pro-max.jpg',
    description: 'The iPhone 15 Pro Max is Apple\'s ultimate flagship with A17 Pro chip, titanium design, and advanced camera system.',
    cameraScore: 95, performanceScore: 98, batteryScore: 85, displayScore: 97, valueScore: 75, overallRating: 9.2,
    pros: 'Best-in-class performance,Excellent camera system,Premium titanium build,Long software support',
    cons: 'Very expensive,No charger included,Heavy weight',
    reviewSummary: 'The iPhone 15 Pro Max is the ultimate flagship with the powerful A17 Pro chip, titanium design, and advanced camera system. Best for users who want the absolute best.',
    reviewVerdict: 'Best overall flagship phone',
    specs: { displayType: 'LTPO Super Retina XDR OLED', display: '6.7 inches', resolution: '1290 x 2796', refreshRate: '120Hz', protection: 'Ceramic Shield', brightness: '2000 nits peak', chipset: 'Apple A17 Pro', cpu: 'Hexa-core', gpu: 'Apple GPU (6-core)', process: '3nm', ram: '8GB', ramType: 'LPDDR5', storage: '256GB/512GB/1TB', cardSlot: 'No', mainCamera: '48 MP', mainCameraSensor: '48MP Main (f/1.78)', aperture: 'f/1.78', ois: 'Yes', eis: 'No', ultrawide: '12MP (f/2.2)', telephoto: '12MP Periscope (f/2.8)', zoom: '5x optical, 25x digital', cameraFeatures: 'Night mode, Deep Fusion, ProRAW, ProRes', videoRecording: '4K@60fps, ProRes, Cinematic mode', selfieCamera: '12 MP', selfieSensor: '12MP TrueDepth (f/1.9)', selfieVideo: '4K@60fps', battery: '4441 mAh', charging: '27W wired', chargingSpeed: '50% in 30min', wirelessCharge: 'Yes', wirelessSpeed: '15W MagSafe', reverseCharge: 'No', weight: '221g', dimensions: '159.9 x 76.7 x 8.3 mm', build: 'Titanium frame, Glass back', sim: 'Dual eSIM', ipRating: 'IP68', network: '5G', fiveG: 'Yes', wifi: 'Wi-Fi 6E', bluetooth: '5.3', nfc: 'Yes', usb: 'USB-C 3.0', fingerprint: 'No', faceUnlock: 'Yes', sensors: 'Face ID, LiDAR, Barometer, Gyro, Accelerometer', colors: 'Natural Titanium, Blue Titanium, White Titanium, Black Titanium', os: 'iOS', osVersion: '17', osUI: 'iOS', updatePolicy: '5+ years guaranteed', specialFeatures: 'Action Button, Dynamic Island, Always-On Display' },
    benchmarks: { antutu: 1640000, geekbenchSingle: 2920, geekbenchMulti: 7250, gamingScore: 92, pubgFps: '60 FPS Max (Stable)', codMobileFps: '60 FPS Max (Stable)', genshinFps: '60 FPS High Settings', videoPlayback: '17 hours', gamingBattery: '7.5 hours', browsingBattery: '14 hours' },
  },
  {
    brand: 'Samsung', model: 'Galaxy S24 Ultra', slug: 'samsung-galaxy-s24-ultra',
    releaseDate: '2024-01-31', pricePKR: 419999, ptaStatus: 'PTA Approved', ptaApproved: true,
    featured: true, trending: true, upcoming: false,
    thumbnail: 'https://fdn2.gsmarena.com/vv/bigpic/samsung-galaxy-s24-ultra-5g.jpg',
    description: 'Samsung Galaxy S24 Ultra is the ultimate Android flagship with best camera system, S Pen, and 7 years of updates.',
    cameraScore: 97, performanceScore: 95, batteryScore: 90, displayScore: 98, valueScore: 80, overallRating: 9.0,
    pros: 'Best camera phone 2024,S Pen included,Excellent display,7 years updates',
    cons: 'Heavy,Expensive,Large size',
    reviewSummary: 'Samsung Galaxy S24 Ultra is the ultimate Android flagship with the best camera system, built-in S Pen, and 7 years of software support.',
    reviewVerdict: 'Best Android camera phone',
    specs: { displayType: 'Dynamic AMOLED 2X', display: '6.8 inches', resolution: '1440 x 3120', refreshRate: '120Hz', protection: 'Gorilla Armor', brightness: '2600 nits peak', chipset: 'Snapdragon 8 Gen 3', cpu: 'Octa-core (1x3.39GHz + 5x3.1GHz + 2x2.9GHz)', gpu: 'Adreno 750', process: '4nm', ram: '12GB', ramType: 'LPDDR5X', storage: '256GB/512GB/1TB', cardSlot: 'No', mainCamera: '200 MP', mainCameraSensor: '200MP ISOCELL HP2 (f/1.7)', aperture: 'f/1.7', ois: 'Yes', eis: 'Yes', ultrawide: '12MP (f/2.2)', telephoto: '50MP (f/3.4) + 10MP (f/2.4)', zoom: '10x optical, 100x digital', cameraFeatures: 'AI Zoom, Expert RAW, Nightography', videoRecording: '8K@30fps, 4K@120fps', selfieCamera: '12 MP', selfieSensor: '12MP (f/2.2)', selfieVideo: '4K@60fps', battery: '5000 mAh', charging: '45W wired', chargingSpeed: '65% in 30min', wirelessCharge: 'Yes', wirelessSpeed: '15W', reverseCharge: 'Yes', weight: '232g', dimensions: '162.3 x 79 x 8.6 mm', build: 'Titanium frame, Gorilla Armor', sim: 'Dual SIM (Nano-SIM)', ipRating: 'IP68', network: '5G', fiveG: 'Yes', wifi: 'Wi-Fi 7', bluetooth: '5.3', nfc: 'Yes', usb: 'USB-C 3.2', fingerprint: 'Ultrasonic (under display)', faceUnlock: 'Yes', sensors: 'Accelerometer, Gyro, Proximity, Compass, Barometer', colors: 'Titanium Gray, Titanium Black, Titanium Violet, Titanium Yellow', os: 'Android', osVersion: '14', osUI: 'One UI 6.1', updatePolicy: '7 years OS + Security', specialFeatures: 'S Pen included, Ultra Wideband (UWB), Samsung DeX' },
    benchmarks: { antutu: 1850000, geekbenchSingle: 2250, geekbenchMulti: 7000, gamingScore: 95, pubgFps: '60 FPS Ultra HD (Stable)', codMobileFps: '60 FPS Max (Stable)', genshinFps: '60 FPS High Settings', videoPlayback: '19 hours', gamingBattery: '8.5 hours', browsingBattery: '15 hours' },
  },
  {
    brand: 'Google', model: 'Pixel 8 Pro', slug: 'google-pixel-8-pro',
    releaseDate: '2023-10-12', pricePKR: 279999, ptaStatus: 'PTA Approved', ptaApproved: true,
    featured: true, trending: true, upcoming: false,
    thumbnail: 'https://fdn2.gsmarena.com/vv/bigpic/google-pixel-8-pro.jpg',
    description: 'Google Pixel 8 Pro offers the best computational photography with 7 years of guaranteed updates.',
    cameraScore: 96, performanceScore: 90, batteryScore: 85, displayScore: 93, valueScore: 85, overallRating: 9.1,
    pros: 'Best computational photography,7 years updates,Clean Android,Excellent AI features',
    cons: 'Slow charging,Average battery life,Expensive accessories',
    reviewSummary: 'Google Pixel 8 Pro delivers the best camera experience through computational photography, backed by 7 years of updates.',
    reviewVerdict: 'Best camera phone for photography enthusiasts',
    specs: { displayType: 'LTPO OLED', display: '6.7 inches', resolution: '1344 x 2992', refreshRate: '120Hz', protection: 'Gorilla Glass Victus 2', brightness: '2400 nits peak', chipset: 'Google Tensor G3', cpu: 'Octa-core (1x3.0GHz + 4x2.6GHz + 3x1.9GHz)', gpu: 'Immortalis-G715s', process: '4nm', ram: '12GB', ramType: 'LPDDR5X', storage: '128GB/256GB/512GB/1TB', cardSlot: 'No', mainCamera: '50 MP', mainCameraSensor: '50MP Samsung GN2 (f/1.68)', aperture: 'f/1.68', ois: 'Yes', eis: 'Yes', ultrawide: '48MP (f/1.7)', telephoto: '48MP (f/2.8)', zoom: '5x optical, 30x digital', cameraFeatures: 'Magic Eraser, Photo Unblur, Best Take, Magic Editor', videoRecording: '4K@60fps, 8K@30fps', selfieCamera: '10.5 MP', selfieSensor: '10.5MP (f/2.2)', selfieVideo: '4K@60fps', battery: '5050 mAh', charging: '30W wired', chargingSpeed: '50% in 30min', wirelessCharge: 'Yes', wirelessSpeed: '23W', reverseCharge: 'Yes', weight: '213g', dimensions: '162.6 x 76.5 x 8.8 mm', build: 'Aluminum frame, Glass back', sim: 'Dual SIM (Nano-SIM + eSIM)', ipRating: 'IP68', network: '5G', fiveG: 'Yes', wifi: 'Wi-Fi 7', bluetooth: '5.3', nfc: 'Yes', usb: 'USB-C 3.2', fingerprint: 'Optical (under display)', faceUnlock: 'Yes', sensors: 'Accelerometer, Gyro, Proximity, Compass, Barometer, Tensor Core', colors: 'Obsidian, Porcelain, Bay', os: 'Android', osVersion: '14', osUI: 'Pixel UI', updatePolicy: '7 years OS + Security', specialFeatures: 'AI-powered features, Tensor G3 chip, Thermometer' },
    benchmarks: { antutu: 1200000, geekbenchSingle: 1750, geekbenchMulti: 4400, gamingScore: 78, pubgFps: '40-60 FPS (Stable)', codMobileFps: '60 FPS (Stable)', genshinFps: '45 FPS Medium Settings', videoPlayback: '18 hours', gamingBattery: '7 hours', browsingBattery: '13 hours' },
  },
  {
    brand: 'OnePlus', model: '12', slug: 'oneplus-12',
    releaseDate: '2024-01-23', pricePKR: 229999, ptaStatus: 'PTA Approved', ptaApproved: true,
    featured: true, trending: true, upcoming: false,
    thumbnail: 'https://fdn2.gsmarena.com/vv/bigpic/oneplus-12.jpg',
    description: 'OnePlus 12 is a flagship killer with Snapdragon 8 Gen 3, Hasselblad camera, and 100W charging.',
    cameraScore: 90, performanceScore: 96, batteryScore: 95, displayScore: 96, valueScore: 90, overallRating: 9.3,
    pros: 'Incredible value for money,100W SUPERVOOC charging,Excellent display,Great cameras',
    cons: 'No wireless charging in all regions,Pre-installed bloatware',
    reviewSummary: 'The OnePlus 12 is the ultimate flagship killer with top-tier specs at a competitive price, featuring the Snapdragon 8 Gen 3 and Hasselblad cameras.',
    reviewVerdict: 'Best value flagship of 2024',
    specs: { displayType: 'LTPO AMOLED', display: '6.82 inches', resolution: '1440 x 3168', refreshRate: '120Hz', protection: 'Gorilla Glass Victus 2', brightness: '4500 nits peak', chipset: 'Snapdragon 8 Gen 3', cpu: 'Octa-core (1x3.3GHz + 5x3.2GHz + 2x2.3GHz)', gpu: 'Adreno 750', process: '4nm', ram: '12GB/16GB', ramType: 'LPDDR5X', storage: '256GB/512GB', cardSlot: 'No', mainCamera: '50 MP', mainCameraSensor: '50MP Sony LYT-808 (f/1.6)', aperture: 'f/1.6', ois: 'Yes', eis: 'Yes', ultrawide: '48MP (f/2.2)', telephoto: '64MP (f/2.6)', zoom: '3x optical, 120x digital', cameraFeatures: 'Hasselblad tuning, RAW+, AI Enhancement', videoRecording: '4K@120fps, 8K@24fps', selfieCamera: '32 MP', selfieSensor: '32MP (f/2.4)', selfieVideo: '4K@30fps', battery: '5400 mAh', charging: '100W SUPERVOOC', chargingSpeed: '100% in 26min', wirelessCharge: 'Yes', wirelessSpeed: '50W', reverseCharge: 'Yes', weight: '220g', dimensions: '164.3 x 75.8 x 9.15 mm', build: 'Aluminum frame, Glass back', sim: 'Dual SIM (Nano-SIM)', ipRating: 'IP65', network: '5G', fiveG: 'Yes', wifi: 'Wi-Fi 7', bluetooth: '5.3', nfc: 'Yes', usb: 'USB-C 3.2', fingerprint: 'Optical (under display)', faceUnlock: 'Yes', sensors: 'Accelerometer, Gyro, Proximity, Compass', colors: 'Flowy Emerald, Silky Black', os: 'Android', osVersion: '14', osUI: 'OxygenOS 14', updatePolicy: '4 years OS updates', specialFeatures: 'Alert Slider, Hasselblad Camera, 100W Charging' },
    benchmarks: { antutu: 2100000, geekbenchSingle: 2200, geekbenchMulti: 6900, gamingScore: 96, pubgFps: '90 FPS Ultra HD (Stable)', codMobileFps: '60 FPS Max (Stable)', genshinFps: '60 FPS Max Settings', videoPlayback: '22 hours', gamingBattery: '9 hours', browsingBattery: '16 hours' },
  },
  {
    brand: 'Xiaomi', model: '14 Ultra', slug: 'xiaomi-14-ultra',
    releaseDate: '2024-03-01', pricePKR: 339999, ptaStatus: 'PTA Approved', ptaApproved: true,
    featured: true, trending: false, upcoming: false,
    thumbnail: 'https://fdn2.gsmarena.com/vv/bigpic/xiaomi-14-ultra.jpg',
    description: 'Xiaomi 14 Ultra features Leica optics with a quad camera system, making it the best camera phone from Xiaomi.',
    cameraScore: 97, performanceScore: 94, batteryScore: 82, displayScore: 94, valueScore: 80, overallRating: 9.0,
    pros: 'Incredible Leica cameras,Snapdragon 8 Gen 3,Beautiful design,Fast charging',
    cons: 'Expensive,Heavy,Average battery life',
    reviewSummary: 'The Xiaomi 14 Ultra is a photography powerhouse with Leica-tuned quad cameras and flagship Snapdragon performance.',
    reviewVerdict: 'Best Leica camera phone',
    specs: { displayType: 'LTPO AMOLED', display: '6.73 inches', resolution: '1440 x 3200', refreshRate: '120Hz', protection: 'Gorilla Glass Victus 2', brightness: '3000 nits peak', chipset: 'Snapdragon 8 Gen 3', cpu: 'Octa-core (1x3.3GHz + 5x3.2GHz + 2x2.3GHz)', gpu: 'Adreno 750', process: '4nm', ram: '12GB/16GB', ramType: 'LPDDR5X', storage: '256GB/512GB/1TB', cardSlot: 'No', mainCamera: '50 MP', mainCameraSensor: '50MP Sony LYT-900 (f/1.63)', aperture: 'f/1.63', ois: 'Yes', eis: 'Yes', ultrawide: '12MP (f/1.8)', telephoto: '50MP (f/1.8) + 50MP (f/2.5)', zoom: '5x optical, 120x digital', cameraFeatures: 'Leica Summilux, Variable Aperture, 8K Video', videoRecording: '4K@120fps, 8K@24fps', selfieCamera: '32 MP', selfieSensor: '32MP (f/2.0)', selfieVideo: '4K@60fps', battery: '5000 mAh', charging: '90W HyperCharge', chargingSpeed: '100% in 33min', wirelessCharge: 'Yes', wirelessSpeed: '80W', reverseCharge: 'Yes', weight: '227g', dimensions: '161.4 x 75.3 x 9.2 mm', build: 'Aluminum frame, Vegan Leather/Glass', sim: 'Dual SIM (Nano-SIM)', ipRating: 'IP68', network: '5G', fiveG: 'Yes', wifi: 'Wi-Fi 7', bluetooth: '5.4', nfc: 'Yes', usb: 'USB-C 3.2', fingerprint: 'Optical (under display)', faceUnlock: 'Yes', sensors: 'Accelerometer, Gyro, Proximity, Compass, Barometer', colors: 'Black, White', os: 'Android', osVersion: '14', osUI: 'HyperOS', updatePolicy: '4 years OS updates', specialFeatures: 'Leica Optics, Variable Aperture, Photography Kit support' },
    benchmarks: { antutu: 2000000, geekbenchSingle: 2180, geekbenchMulti: 6850, gamingScore: 94, pubgFps: '90 FPS (Stable)', codMobileFps: '60 FPS Max (Stable)', genshinFps: '60 FPS High Settings', videoPlayback: '17 hours', gamingBattery: '7 hours', browsingBattery: '12 hours' },
  },
  {
    brand: 'Samsung', model: 'Galaxy A55 5G', slug: 'samsung-galaxy-a55-5g',
    releaseDate: '2024-03-15', pricePKR: 94999, ptaStatus: 'PTA Approved', ptaApproved: true,
    featured: false, trending: true, upcoming: false,
    thumbnail: 'https://fdn2.gsmarena.com/vv/bigpic/samsung-galaxy-a55-5g.jpg',
    description: 'Samsung Galaxy A55 5G is the best mid-range Samsung phone with premium design, great cameras, and 4 years of updates.',
    cameraScore: 82, performanceScore: 72, batteryScore: 88, displayScore: 85, valueScore: 90, overallRating: 8.3,
    pros: 'Premium glass design,Great main camera,IP67 water resistance,4 years updates',
    cons: 'No charger in box,Slower charging,Thick bezels',
    reviewSummary: 'The Galaxy A55 5G is Samsung\'s best mid-range offering with a premium glass design, excellent main camera, and long software support.',
    reviewVerdict: 'Best mid-range Samsung phone',
    specs: { displayType: 'Super AMOLED', display: '6.6 inches', resolution: '1080 x 2340', refreshRate: '120Hz', protection: 'Gorilla Glass Victus+', brightness: '1000 nits peak', chipset: 'Exynos 1480', cpu: 'Octa-core (4x2.75GHz + 4x2.0GHz)', gpu: 'Xclipse 530', process: '4nm', ram: '8GB/12GB', ramType: 'LPDDR5', storage: '128GB/256GB', cardSlot: 'microSD up to 1TB', mainCamera: '50 MP', mainCameraSensor: '50MP (f/1.8)', aperture: 'f/1.8', ois: 'Yes', eis: 'Yes', ultrawide: '12MP (f/2.2)', telephoto: '5MP (f/2.4)', zoom: 'No optical zoom', cameraFeatures: 'Nightography, OIS, 4K Video', videoRecording: '4K@30fps, 1080p@60fps', selfieCamera: '32 MP', selfieSensor: '32MP (f/2.2)', selfieVideo: '4K@30fps', battery: '5000 mAh', charging: '25W wired', chargingSpeed: '50% in 30min', wirelessCharge: 'No', wirelessSpeed: '', reverseCharge: 'No', weight: '213g', dimensions: '161.7 x 77 x 8.2 mm', build: 'Glass back, Aluminum frame', sim: 'Dual SIM (Nano-SIM)', ipRating: 'IP67', network: '5G', fiveG: 'Yes', wifi: 'Wi-Fi 6', bluetooth: '5.3', nfc: 'Yes', usb: 'USB-C 2.0', fingerprint: 'Optical (under display)', faceUnlock: 'Yes', sensors: 'Accelerometer, Gyro, Proximity, Compass', colors: 'Awesome Iceblue, Awesome Lilac, Awesome Lemon, Awesome Navy', os: 'Android', osVersion: '14', osUI: 'One UI 6.1', updatePolicy: '4 years OS + 5 years security', specialFeatures: 'Samsung Pay, Knox Security' },
    benchmarks: { antutu: 650000, geekbenchSingle: 1050, geekbenchMulti: 2800, gamingScore: 55, pubgFps: '40 FPS HD (Stable)', codMobileFps: '40 FPS (Stable)', genshinFps: '30 FPS Low Settings', videoPlayback: '20 hours', gamingBattery: '8 hours', browsingBattery: '14 hours' },
  },
  {
    brand: 'Xiaomi', model: 'Redmi Note 13 Pro+', slug: 'xiaomi-redmi-note-13-pro-plus',
    releaseDate: '2023-09-21', pricePKR: 89999, ptaStatus: 'PTA Approved', ptaApproved: true,
    featured: false, trending: true, upcoming: false,
    thumbnail: 'https://fdn2.gsmarena.com/vv/bigpic/xiaomi-redmi-note-13-pro-plus-5g-.jpg',
    description: 'Redmi Note 13 Pro+ is the king of mid-range with 200MP camera, 120W charging, and curved AMOLED display.',
    cameraScore: 86, performanceScore: 75, batteryScore: 90, displayScore: 90, valueScore: 92, overallRating: 8.7,
    pros: '200MP camera,120W fast charging,Beautiful curved display,IP68 water resistance',
    cons: 'Mediatek processor,Pre-installed ads,No wireless charging',
    reviewSummary: 'The Redmi Note 13 Pro+ packs flagship features like a 200MP camera and 120W charging into an affordable mid-range package.',
    reviewVerdict: 'Best mid-range camera phone',
    specs: { displayType: 'Curved AMOLED', display: '6.67 inches', resolution: '1200 x 2712', refreshRate: '120Hz', protection: 'Gorilla Glass Victus', brightness: '1800 nits peak', chipset: 'MediaTek Dimensity 7200-Ultra', cpu: 'Octa-core (2x2.8GHz + 6x2.0GHz)', gpu: 'Mali-G715', process: '4nm', ram: '8GB/12GB', ramType: 'LPDDR5', storage: '256GB/512GB', cardSlot: 'No', mainCamera: '200 MP', mainCameraSensor: '200MP Samsung ISOCELL HP3 (f/1.69)', aperture: 'f/1.69', ois: 'Yes', eis: 'Yes', ultrawide: '8MP (f/2.2)', telephoto: '2MP (f/2.4)', zoom: 'No optical zoom', cameraFeatures: '200MP mode, Night mode, AI Camera', videoRecording: '4K@30fps, 1080p@60fps', selfieCamera: '32 MP', selfieSensor: '32MP (f/2.0)', selfieVideo: '1080p@30fps', battery: '5000 mAh', charging: '120W HyperCharge', chargingSpeed: '100% in 19min', wirelessCharge: 'No', wirelessSpeed: '', reverseCharge: 'No', weight: '204g', dimensions: '161.4 x 74.2 x 8.9 mm', build: 'Glass back, Plastic frame', sim: 'Dual SIM (Nano-SIM)', ipRating: 'IP68', network: '5G', fiveG: 'Yes', wifi: 'Wi-Fi 6', bluetooth: '5.3', nfc: 'Yes', usb: 'USB-C 2.0', fingerprint: 'Optical (under display)', faceUnlock: 'Yes', sensors: 'Accelerometer, Gyro, Proximity, Compass', colors: 'Violet, Black, Purple, White', os: 'Android', osVersion: '13', osUI: 'MIUI 14', updatePolicy: '3 years OS updates', specialFeatures: 'Infrared blaster, 3.5mm jack adapter' },
    benchmarks: { antutu: 720000, geekbenchSingle: 1100, geekbenchMulti: 3000, gamingScore: 60, pubgFps: '40-60 FPS HD (Stable)', codMobileFps: '40 FPS (Stable)', genshinFps: '30 FPS Low-Medium', videoPlayback: '21 hours', gamingBattery: '8 hours', browsingBattery: '15 hours' },
  },
  {
    brand: 'Realme', model: 'GT 5 Pro', slug: 'realme-gt-5-pro',
    releaseDate: '2024-01-04', pricePKR: 139999, ptaStatus: 'PTA Approved', ptaApproved: true,
    featured: true, trending: false, upcoming: false,
    thumbnail: 'https://fdn2.gsmarena.com/vv/bigpic/realme-gt5-pro.jpg',
    description: 'Realme GT 5 Pro brings Snapdragon 8 Gen 3 performance at a fraction of the cost with a periscope camera.',
    cameraScore: 88, performanceScore: 95, batteryScore: 88, displayScore: 93, valueScore: 95, overallRating: 9.1,
    pros: 'Snapdragon 8 Gen 3 at great price,Periscope telephoto,Excellent display,100W charging',
    cons: 'No wireless charging,Only available in select markets,Heavy',
    reviewSummary: 'The Realme GT 5 Pro offers flagship Snapdragon 8 Gen 3 performance with a periscope camera at an incredible price point.',
    reviewVerdict: 'Best value flagship killer',
    specs: { displayType: 'LTPO AMOLED', display: '6.78 inches', resolution: '1440 x 2780', refreshRate: '120Hz', protection: 'Gorilla Glass Victus 2', brightness: '6000 nits peak', chipset: 'Snapdragon 8 Gen 3', cpu: 'Octa-core (1x3.3GHz + 5x3.2GHz + 2x2.3GHz)', gpu: 'Adreno 750', process: '4nm', ram: '8GB/12GB/16GB', ramType: 'LPDDR5X', storage: '256GB/512GB/1TB', cardSlot: 'No', mainCamera: '50 MP', mainCameraSensor: '50MP Sony LYT-808 (f/1.69)', aperture: 'f/1.69', ois: 'Yes', eis: 'Yes', ultrawide: '8MP (f/2.2)', telephoto: '50MP (f/2.6)', zoom: '3x optical', cameraFeatures: 'Periscope telephoto, Night mode, AI Camera', videoRecording: '4K@60fps, 8K@24fps', selfieCamera: '32 MP', selfieSensor: '32MP (f/2.4)', selfieVideo: '4K@30fps', battery: '5400 mAh', charging: '100W SUPERVOOC', chargingSpeed: '100% in 26min', wirelessCharge: 'No', wirelessSpeed: '', reverseCharge: 'No', weight: '218g', dimensions: '161.7 x 75.1 x 9.0 mm', build: 'Aluminum frame, Glass/Leather back', sim: 'Dual SIM (Nano-SIM)', ipRating: 'IP64', network: '5G', fiveG: 'Yes', wifi: 'Wi-Fi 7', bluetooth: '5.3', nfc: 'Yes', usb: 'USB-C 3.2', fingerprint: 'Optical (under display)', faceUnlock: 'Yes', sensors: 'Accelerometer, Gyro, Proximity, Compass', colors: 'Pioneer Green, Submarine Blue, Moon White', os: 'Android', osVersion: '14', osUI: 'Realme UI 5.0', updatePolicy: '3 years OS updates', specialFeatures: 'Infrared blaster, Alert Slider' },
    benchmarks: { antutu: 2050000, geekbenchSingle: 2200, geekbenchMulti: 6850, gamingScore: 94, pubgFps: '90 FPS (Stable)', codMobileFps: '60 FPS Max (Stable)', genshinFps: '60 FPS High Settings', videoPlayback: '21 hours', gamingBattery: '9 hours', browsingBattery: '16 hours' },
  },
  {
    brand: 'Infinix', model: 'Note 40 Pro', slug: 'infinix-note-40-pro',
    releaseDate: '2024-03-18', pricePKR: 52999, ptaStatus: 'PTA Approved', ptaApproved: true,
    featured: false, trending: true, upcoming: false,
    thumbnail: 'https://fdn2.gsmarena.com/vv/bigpic/infinix-note-40-pro.jpg',
    description: 'Infinix Note 40 Pro offers wireless charging and MagSafe at a budget price, a first for the segment.',
    cameraScore: 72, performanceScore: 62, batteryScore: 92, displayScore: 80, valueScore: 95, overallRating: 8.0,
    pros: 'Wireless charging under 60K,MagSafe support,Beautiful design,Good battery life',
    cons: 'Mediatek Helio G99,Only 33W wired charging, Average performance',
    reviewSummary: 'The Infinix Note 40 Pro brings premium features like wireless charging and MagSafe to the budget segment.',
    reviewVerdict: 'Best budget phone with wireless charging',
    specs: { displayType: 'AMOLED', display: '6.78 inches', resolution: '1080 x 2436', refreshRate: '120Hz', protection: 'Corning Gorilla Glass', brightness: '1300 nits peak', chipset: 'MediaTek Helio G99', cpu: 'Octa-core (2x2.2GHz + 6x2.0GHz)', gpu: 'Mali-G57 MC2', process: '6nm', ram: '8GB', ramType: 'LPDDR4X', storage: '256GB', cardSlot: 'microSD up to 2TB', mainCamera: '108 MP', mainCameraSensor: '108MP (f/1.75)', aperture: 'f/1.75', ois: 'Yes', eis: 'Yes', ultrawide: '2MP (f/2.4)', telephoto: '', zoom: 'No optical zoom', cameraFeatures: '108MP mode, Night mode, AI Camera', videoRecording: '2K@30fps, 1080p@60fps', selfieCamera: '32 MP', selfieSensor: '32MP (f/2.0)', selfieVideo: '1080p@30fps', battery: '5000 mAh', charging: '33W wired', chargingSpeed: '55% in 30min', wirelessCharge: 'Yes', wirelessSpeed: '20W MagSafe compatible', reverseCharge: 'Yes', weight: '190g', dimensions: '164.4 x 74.1 x 7.6 mm', build: 'Glass back, Plastic frame', sim: 'Dual SIM (Nano-SIM)', ipRating: 'IP54', network: '4G', fiveG: 'No', wifi: 'Wi-Fi 5', bluetooth: '5.3', nfc: 'Yes', usb: 'USB-C 2.0', fingerprint: 'Side-mounted', faceUnlock: 'Yes', sensors: 'Accelerometer, Gyro, Proximity, Compass', colors: 'Titan Gold, Vintage Green, Obsidian Black', os: 'Android', osVersion: '14', osUI: 'XOS 14', updatePolicy: '2 years OS updates', specialFeatures: 'Wireless charging, MagSafe, JBL speakers' },
    benchmarks: { antutu: 380000, geekbenchSingle: 560, geekbenchMulti: 1800, gamingScore: 35, pubgFps: '30-40 FPS HD (Stable)', codMobileFps: '30 FPS (Stable)', genshinFps: '20-30 FPS Low', videoPlayback: '24 hours', gamingBattery: '9 hours', browsingBattery: '16 hours' },
  },
  {
    brand: 'Vivo', model: 'X100 Pro', slug: 'vivo-x100-pro',
    releaseDate: '2024-01-12', pricePKR: 249999, ptaStatus: 'PTA Approved', ptaApproved: true,
    featured: true, trending: false, upcoming: false,
    thumbnail: 'https://fdn2.gsmarena.com/vv/bigpic/vivo-x100-pro.jpg',
    description: 'Vivo X100 Pro features Zeiss optics with a periscope telephoto camera co-developed with Zeiss.',
    cameraScore: 96, performanceScore: 93, batteryScore: 86, displayScore: 92, valueScore: 82, overallRating: 9.0,
    pros: 'Zeiss optics partnership,Excellent periscope zoom,Fast charging,Great display',
    cons: 'Expensive,Funtouch OS has bloatware,Limited availability',
    reviewSummary: 'The Vivo X100 Pro delivers Zeiss-caliber photography with a powerful Dimensity 9300 chipset and excellent fast charging.',
    reviewVerdict: 'Best Zeiss camera phone',
    specs: { displayType: 'LTPO AMOLED', display: '6.78 inches', resolution: '1260 x 2800', refreshRate: '120Hz', protection: 'Schott Xensation Alpha', brightness: '3000 nits peak', chipset: 'MediaTek Dimensity 9300', cpu: 'Octa-core (1x3.25GHz + 3x2.85GHz + 4x2.0GHz)', gpu: 'Immortalis-G720', process: '4nm', ram: '12GB/16GB', ramType: 'LPDDR5T', storage: '256GB/512GB/1TB', cardSlot: 'No', mainCamera: '50 MP', mainCameraSensor: '50MP Sony IMX989 (f/1.75)', aperture: 'f/1.75', ois: 'Yes', eis: 'Yes', ultrawide: '50MP (f/2.0)', telephoto: '50MP (f/2.5)', zoom: '4.3x optical, 100x digital', cameraFeatures: 'Zeiss T* coating, Zeiss portrait modes, Night mode', videoRecording: '4K@120fps, 8K@30fps', selfieCamera: '32 MP', selfieSensor: '32MP (f/2.0)', selfieVideo: '4K@30fps', battery: '5400 mAh', charging: '100W FlashCharge', chargingSpeed: '100% in 27min', wirelessCharge: 'Yes', wirelessSpeed: '50W', reverseCharge: 'Yes', weight: '225g', dimensions: '164.0 x 75.3 x 8.5 mm', build: 'Aluminum frame, Glass back', sim: 'Dual SIM (Nano-SIM)', ipRating: 'IP68', network: '5G', fiveG: 'Yes', wifi: 'Wi-Fi 7', bluetooth: '5.4', nfc: 'Yes', usb: 'USB-C 3.2', fingerprint: 'Optical (under display)', faceUnlock: 'Yes', sensors: 'Accelerometer, Gyro, Proximity, Compass', colors: 'Brekking Blue, Cosmic Black, White', os: 'Android', osVersion: '14', osUI: 'Funtouch OS 14', updatePolicy: '3 years OS updates', specialFeatures: 'Zeiss Optics, Infrared blaster, Hi-Res Audio' },
    benchmarks: { antutu: 1950000, geekbenchSingle: 2100, geekbenchMulti: 6700, gamingScore: 90, pubgFps: '90 FPS (Stable)', codMobileFps: '60 FPS Max (Stable)', genshinFps: '60 FPS High Settings', videoPlayback: '19 hours', gamingBattery: '8.5 hours', browsingBattery: '15 hours' },
  },
  {
    brand: 'Apple', model: 'iPhone 15', slug: 'iphone-15',
    releaseDate: '2023-09-22', pricePKR: 359999, ptaStatus: 'PTA Approved', ptaApproved: true,
    featured: true, trending: false, upcoming: false,
    thumbnail: 'https://fdn2.gsmarena.com/vv/bigpic/apple-iphone-15.jpg',
    description: 'iPhone 15 brings Dynamic Island, 48MP camera, and USB-C to the standard iPhone lineup.',
    cameraScore: 88, performanceScore: 92, batteryScore: 80, displayScore: 88, valueScore: 72, overallRating: 8.6,
    pros: 'Dynamic Island,48MP camera,USB-C,A17 Pro chip',
    cons: '60Hz display (standard model),No always-on display,Base storage is 128GB',
    reviewSummary: 'The iPhone 15 brings the Dynamic Island and USB-C to the standard model, making it a solid choice for most users.',
    reviewVerdict: 'Best premium mid-range phone',
    specs: { displayType: 'Super Retina XDR OLED', display: '6.1 inches', resolution: '1179 x 2556', refreshRate: '60Hz', protection: 'Ceramic Shield', brightness: '2000 nits peak', chipset: 'Apple A16 Bionic', cpu: 'Hexa-core', gpu: 'Apple GPU (5-core)', process: '4nm', ram: '6GB', ramType: 'LPDDR5', storage: '128GB/256GB/512GB', cardSlot: 'No', mainCamera: '48 MP', mainCameraSensor: '48MP (f/1.6)', aperture: 'f/1.6', ois: 'Yes', eis: 'Yes', ultrawide: '12MP (f/2.4)', telephoto: '', zoom: '2x digital', cameraFeatures: 'Night mode, Deep Fusion, Smart HDR 5', videoRecording: '4K@60fps, Cinematic mode', selfieCamera: '12 MP', selfieSensor: '12MP TrueDepth (f/1.9)', selfieVideo: '4K@60fps', battery: '3877 mAh', charging: '20W wired', chargingSpeed: '50% in 30min', wirelessCharge: 'Yes', wirelessSpeed: '15W MagSafe', reverseCharge: 'No', weight: '171g', dimensions: '146.6 x 71.6 x 7.8 mm', build: 'Aluminum frame, Glass back', sim: 'Dual SIM (Nano-SIM + eSIM)', ipRating: 'IP68', network: '5G', fiveG: 'Yes', wifi: 'Wi-Fi 6', bluetooth: '5.3', nfc: 'Yes', usb: 'USB-C 2.0', fingerprint: 'No', faceUnlock: 'Yes', sensors: 'Face ID, Barometer, Gyro, Accelerometer', colors: 'Blue, Pink, Yellow, Green, Black', os: 'iOS', osVersion: '17', osUI: 'iOS', updatePolicy: '5+ years guaranteed', specialFeatures: 'Dynamic Island, USB-C, Emergency SOS via satellite' },
    benchmarks: { antutu: 1400000, geekbenchSingle: 2650, geekbenchMulti: 6500, gamingScore: 85, pubgFps: '60 FPS (Stable)', codMobileFps: '60 FPS (Stable)', genshinFps: '60 FPS Medium Settings', videoPlayback: '16 hours', gamingBattery: '6.5 hours', browsingBattery: '12 hours' },
  },
  {
    brand: 'Samsung', model: 'Galaxy A35 5G', slug: 'samsung-galaxy-a35-5g',
    releaseDate: '2024-03-22', pricePKR: 64999, ptaStatus: 'PTA Approved', ptaApproved: true,
    featured: false, trending: false, upcoming: false,
    thumbnail: 'https://fdn2.gsmarena.com/vv/bigpic/samsung-galaxy-a35-5g.jpg',
    description: 'Samsung Galaxy A35 5G offers Samsung quality with water resistance and long updates at a budget price.',
    cameraScore: 78, performanceScore: 65, batteryScore: 86, displayScore: 82, valueScore: 88, overallRating: 7.9,
    pros: 'IP67 water resistance,4 years updates,Good main camera,Samsung ecosystem',
    cons: 'Exynos 1380 is slow,Thick bezels,No charger in box,Only 25W charging',
    reviewSummary: 'The Galaxy A35 5G is a solid budget choice from Samsung with water resistance and long software support.',
    reviewVerdict: 'Best budget Samsung phone',
    specs: { displayType: 'Super AMOLED', display: '6.6 inches', resolution: '1080 x 2340', refreshRate: '120Hz', protection: 'Gorilla Glass Victus+', brightness: '800 nits peak', chipset: 'Exynos 1380', cpu: 'Octa-core (4x2.4GHz + 4x2.0GHz)', gpu: 'Mali-G68 MP5', process: '5nm', ram: '6GB/8GB', ramType: 'LPDDR4X', storage: '128GB/256GB', cardSlot: 'microSD up to 1TB', mainCamera: '50 MP', mainCameraSensor: '50MP (f/1.8)', aperture: 'f/1.8', ois: 'Yes', eis: 'Yes', ultrawide: '8MP (f/2.2)', telephoto: '5MP (f/2.4)', zoom: 'No optical zoom', cameraFeatures: 'Night mode, OIS, 4K Video', videoRecording: '4K@30fps, 1080p@60fps', selfieCamera: '13 MP', selfieSensor: '13MP (f/2.2)', selfieVideo: '4K@30fps', battery: '5000 mAh', charging: '25W wired', chargingSpeed: '50% in 30min', wirelessCharge: 'No', wirelessSpeed: '', reverseCharge: 'No', weight: '209g', dimensions: '161.7 x 77.4 x 8.2 mm', build: 'Glass back, Plastic frame', sim: 'Dual SIM (Nano-SIM)', ipRating: 'IP67', network: '5G', fiveG: 'Yes', wifi: 'Wi-Fi 5', bluetooth: '5.3', nfc: 'Yes', usb: 'USB-C 2.0', fingerprint: 'Optical (under display)', faceUnlock: 'Yes', sensors: 'Accelerometer, Gyro, Proximity, Compass', colors: 'Awesome Iceblue, Awesome Lilac, Awesome Lemon, Awesome Navy', os: 'Android', osVersion: '14', osUI: 'One UI 6.1', updatePolicy: '4 years OS + 5 years security', specialFeatures: 'Samsung Pay, Knox Security' },
    benchmarks: { antutu: 480000, geekbenchSingle: 780, geekbenchMulti: 2100, gamingScore: 42, pubgFps: '30-40 FPS HD (Stable)', codMobileFps: '30 FPS (Stable)', genshinFps: '20-30 FPS Low', videoPlayback: '22 hours', gamingBattery: '8 hours', browsingBattery: '15 hours' },
  },
  {
    brand: 'Tecno', model: 'Camon 30 Premier', slug: 'tecno-camon-30-premier',
    releaseDate: '2024-04-15', pricePKR: 109999, ptaStatus: 'PTA Approved', ptaApproved: true,
    featured: false, trending: false, upcoming: false,
    thumbnail: 'https://fdn2.gsmarena.com/vv/bigpic/tecno-camon-30-premier.jpg',
    description: 'Tecno Camon 30 Premier features Sony IMX890 sensor with professional-grade video recording.',
    cameraScore: 85, performanceScore: 72, batteryScore: 85, displayScore: 83, valueScore: 88, overallRating: 8.2,
    pros: 'Sony IMX890 sensor,4K video recording under 110K,Fast charging,Good display',
    cons: 'Mediatek Dimensity 8200,HiOS has bloatware,Limited brand recognition',
    reviewSummary: 'The Tecno Camon 30 Premier delivers impressive camera performance with the Sony IMX890 sensor at a competitive price.',
    reviewVerdict: 'Best camera phone under 120K',
    specs: { displayType: 'LTPO AMOLED', display: '6.77 inches', resolution: '1260 x 2780', refreshRate: '120Hz', protection: 'Corning Gorilla Glass 5', brightness: '1400 nits peak', chipset: 'MediaTek Dimensity 8200 Ultimate', cpu: 'Octa-core (1x3.1GHz + 3x3.0GHz + 4x2.0GHz)', gpu: 'Mali-G610 MC6', process: '4nm', ram: '12GB', ramType: 'LPDDR5', storage: '256GB/512GB', cardSlot: 'No', mainCamera: '50 MP', mainCameraSensor: '50MP Sony IMX890 (f/1.57)', aperture: 'f/1.57', ois: 'Yes', eis: 'Yes', ultrawide: '50MP (f/2.2)', telephoto: '50MP (f/2.9)', zoom: '3x optical', cameraFeatures: '4K video, Night mode, AI Camera, Pro mode', videoRecording: '4K@60fps', selfieCamera: '50 MP', selfieSensor: '50MP (f/2.2)', selfieVideo: '4K@30fps', battery: '5000 mAh', charging: '70W Flash Charge', chargingSpeed: '100% in 45min', wirelessCharge: 'No', wirelessSpeed: '', reverseCharge: 'No', weight: '195g', dimensions: '162.7 x 75.4 x 8.1 mm', build: 'Glass back, Aluminum frame', sim: 'Dual SIM (Nano-SIM)', ipRating: 'IP65', network: '5G', fiveG: 'Yes', wifi: 'Wi-Fi 6', bluetooth: '5.3', nfc: 'Yes', usb: 'USB-C 2.0', fingerprint: 'Optical (under display)', faceUnlock: 'Yes', sensors: 'Accelerometer, Gyro, Proximity, Compass', colors: 'Alps Sandy Gold, Dark Chrome', os: 'Android', osVersion: '14', osUI: 'HiOS 14', updatePolicy: '2 years OS updates', specialFeatures: 'Sony IMX890, Hi-Res Audio, DTS sound' },
    benchmarks: { antutu: 850000, geekbenchSingle: 1150, geekbenchMulti: 3200, gamingScore: 65, pubgFps: '40-60 FPS HD (Stable)', codMobileFps: '40 FPS (Stable)', genshinFps: '30-40 FPS Medium', videoPlayback: '19 hours', gamingBattery: '7.5 hours', browsingBattery: '14 hours' },
  },
  {
    brand: 'Nothing', model: 'Phone (2a)', slug: 'nothing-phone-2a',
    releaseDate: '2024-03-05', pricePKR: 69999, ptaStatus: 'PTA Approved', ptaApproved: true,
    featured: false, trending: true, upcoming: false,
    thumbnail: 'https://fdn2.gsmarena.com/vv/bigpic/nothing-phone-2a.jpg',
    description: 'Nothing Phone (2a) brings the unique Glyph interface and clean Android to the mid-range segment.',
    cameraScore: 76, performanceScore: 70, batteryScore: 85, displayScore: 82, valueScore: 92, overallRating: 8.2,
    pros: 'Unique Glyph design,Clean Android,Good build quality,Fair price',
    cons: 'Dimensity 7200 Pro is average,No wireless charging,No IP rating',
    reviewSummary: 'The Nothing Phone (2a) offers a unique design with the Glyph interface and clean software experience at an affordable price.',
    reviewVerdict: 'Best unique design phone under 70K',
    specs: { displayType: 'AMOLED', display: '6.7 inches', resolution: '1080 x 2412', refreshRate: '120Hz', protection: 'Corning Gorilla Glass 5', brightness: '1300 nits peak', chipset: 'MediaTek Dimensity 7200 Pro', cpu: 'Octa-core (2x2.8GHz + 6x2.0GHz)', gpu: 'Mali-G715', process: '4nm', ram: '8GB/12GB', ramType: 'LPDDR4X', storage: '128GB/256GB', cardSlot: 'No', mainCamera: '50 MP', mainCameraSensor: '50MP Sony LYT-600 (f/1.88)', aperture: 'f/1.88', ois: 'Yes', eis: 'Yes', ultrawide: '50MP (f/2.2)', telephoto: '', zoom: 'No optical zoom', cameraFeatures: 'Night mode, AI scenes, Nothing Camera app', videoRecording: '4K@30fps, 1080p@60fps', selfieCamera: '50 MP', selfieSensor: '50MP (f/2.0)', selfieVideo: '1080p@30fps', battery: '5000 mAh', charging: '50W', chargingSpeed: '50% in 20min', wirelessCharge: 'No', wirelessSpeed: '', reverseCharge: 'No', weight: '190g', dimensions: '161.7 x 76.3 x 8.6 mm', build: 'Plastic frame, Glass back', sim: 'Dual SIM (Nano-SIM)', ipRating: 'IP54', network: '5G', fiveG: 'Yes', wifi: 'Wi-Fi 6', bluetooth: '5.3', nfc: 'Yes', usb: 'USB-C 2.0', fingerprint: 'Side-mounted', faceUnlock: 'Yes', sensors: 'Accelerometer, Gyro, Proximity, Compass', colors: 'White, Black, Milk', os: 'Android', osVersion: '14', osUI: 'Nothing OS 2.5', updatePolicy: '3 years OS updates', specialFeatures: 'Glyph Interface, Clean Android, Symmetrical Bezels' },
    benchmarks: { antutu: 700000, geekbenchSingle: 1050, geekbenchMulti: 2900, gamingScore: 58, pubgFps: '40 FPS HD (Stable)', codMobileFps: '40 FPS (Stable)', genshinFps: '30 FPS Low-Medium', videoPlayback: '22 hours', gamingBattery: '8.5 hours', browsingBattery: '15 hours' },
  },
  {
    brand: 'Oppo', model: 'Find X7 Ultra', slug: 'oppo-find-x7-ultra',
    releaseDate: '2024-01-08', pricePKR: 319999, ptaStatus: 'PTA Approved', ptaApproved: true,
    featured: true, trending: false, upcoming: false,
    thumbnail: 'https://fdn2.gsmarena.com/vv/bigpic/oppo-find-x7-ultra.jpg',
    description: 'Oppo Find X7 Ultra features dual periscope cameras co-developed with Hasselblad, a first in the industry.',
    cameraScore: 98, performanceScore: 95, batteryScore: 84, displayScore: 94, valueScore: 78, overallRating: 9.2,
    pros: 'Dual periscope cameras,Hasselblad tuning,Snapdragon 8 Gen 3,Excellent display',
    cons: 'Very expensive,Heavy,Limited global availability',
    reviewSummary: 'The Oppo Find X7 Ultra pushes camera boundaries with dual periscope lenses and Hasselblad color science.',
    reviewVerdict: 'Best dual periscope camera phone',
    specs: { displayType: 'LTPO AMOLED', display: '6.82 inches', resolution: '1440 x 3168', refreshRate: '120Hz', protection: 'Gorilla Glass Victus 2', brightness: '4500 nits peak', chipset: 'Snapdragon 8 Gen 3', cpu: 'Octa-core (1x3.3GHz + 5x3.2GHz + 2x2.3GHz)', gpu: 'Adreno 750', process: '4nm', ram: '12GB/16GB', ramType: 'LPDDR5X', storage: '256GB/512GB/1TB', cardSlot: 'No', mainCamera: '50 MP', mainCameraSensor: '50MP Sony LYT-900 (f/1.7)', aperture: 'f/1.7', ois: 'Yes', eis: 'Yes', ultrawide: '50MP (f/2.2)', telephoto: '50MP (f/2.6) + 64MP (f/2.7)', zoom: '3x + 6x optical, 120x digital', cameraFeatures: 'Hasselblad tuning, Dual Periscope, 4K Dolby Vision', videoRecording: '4K@120fps, 8K@30fps, Dolby Vision', selfieCamera: '32 MP', selfieSensor: '32MP (f/2.4)', selfieVideo: '4K@30fps', battery: '5400 mAh', charging: '100W SUPERVOOC', chargingSpeed: '100% in 26min', wirelessCharge: 'Yes', wirelessSpeed: '50W', reverseCharge: 'Yes', weight: '227g', dimensions: '164.3 x 76.2 x 9.4 mm', build: 'Aluminum frame, Glass/Leather back', sim: 'Dual SIM (Nano-SIM)', ipRating: 'IP68', network: '5G', fiveG: 'Yes', wifi: 'Wi-Fi 7', bluetooth: '5.4', nfc: 'Yes', usb: 'USB-C 3.2', fingerprint: 'Optical (under display)', faceUnlock: 'Yes', sensors: 'Accelerometer, Gyro, Proximity, Compass, Barometer', colors: 'Hasselblad Brown, Ocean Blue', os: 'Android', osVersion: '14', osUI: 'ColorOS 14', updatePolicy: '4 years OS updates', specialFeatures: 'Dual Periscope, Hasselblad, Ultra HDR, Alert Slider' },
    benchmarks: { antutu: 2080000, geekbenchSingle: 2200, geekbenchMulti: 6900, gamingScore: 95, pubgFps: '90 FPS (Stable)', codMobileFps: '60 FPS Max (Stable)', genshinFps: '60 FPS High Settings', videoPlayback: '20 hours', gamingBattery: '8.5 hours', browsingBattery: '15 hours' },
  },
  {
    brand: 'Motorola', model: 'Edge 50 Pro', slug: 'motorola-edge-50-pro',
    releaseDate: '2024-04-03', pricePKR: 119999, ptaStatus: 'PTA Approved', ptaApproved: true,
    featured: false, trending: false, upcoming: false,
    thumbnail: 'https://fdn2.gsmarena.com/vv/bigpic/motorola-edge-50-pro.jpg',
    description: 'Motorola Edge 50 Pro offers a vegan leather back, 125W charging, and clean near-stock Android experience.',
    cameraScore: 82, performanceScore: 78, batteryScore: 87, displayScore: 88, valueScore: 86, overallRating: 8.4,
    pros: '125W fastest charging,Vegan leather design,Clean Android,Great display',
    cons: 'Snapdragon 7 Gen 3 (not flagship),Average telephoto,No IP rating',
    reviewSummary: 'The Motorola Edge 50 Pro delivers ultra-fast 125W charging, a beautiful vegan leather design, and clean Android at a competitive price.',
    reviewVerdict: 'Best fast charging phone under 120K',
    specs: { displayType: 'pOLED', display: '6.7 inches', resolution: '1440 x 2712', refreshRate: '144Hz', protection: 'Corning Gorilla Glass 5', brightness: '2000 nits peak', chipset: 'Snapdragon 7 Gen 3', cpu: 'Octa-core (1x2.63GHz + 3x2.4GHz + 4x1.8GHz)', gpu: 'Adreno 720', process: '4nm', ram: '12GB', ramType: 'LPDDR5', storage: '256GB/512GB', cardSlot: 'No', mainCamera: '50 MP', mainCameraSensor: '50MP (f/1.4)', aperture: 'f/1.4', ois: 'Yes', eis: 'Yes', ultrawide: '13MP (f/2.2)', telephoto: '10MP (f/2.0)', zoom: '3x optical', cameraFeatures: 'Night Vision, AI Camera, Moto Camera app', videoRecording: '4K@60fps', selfieCamera: '50 MP', selfieSensor: '50MP (f/1.9)', selfieVideo: '4K@30fps', battery: '4500 mAh', charging: '125W TurboPower', chargingSpeed: '100% in 18min', wirelessCharge: 'Yes', wirelessSpeed: '50W', reverseCharge: 'No', weight: '186g', dimensions: '161.9 x 72.3 x 8.3 mm', build: 'Aluminum frame, Vegan Leather/Glass', sim: 'Dual SIM (Nano-SIM)', ipRating: 'IP68', network: '5G', fiveG: 'Yes', wifi: 'Wi-Fi 7', bluetooth: '5.3', nfc: 'Yes', usb: 'USB-C 3.2', fingerprint: 'Optical (under display)', faceUnlock: 'Yes', sensors: 'Accelerometer, Gyro, Proximity, Compass', colors: 'Moonlight Pearl, Black Beauty, Luxe Lavender', os: 'Android', osVersion: '14', osUI: 'My UX (near-stock)', updatePolicy: '3 years OS updates', specialFeatures: 'Ready For (desktop mode), ThinkShield security' },
    benchmarks: { antutu: 900000, geekbenchSingle: 1400, geekbenchMulti: 4000, gamingScore: 70, pubgFps: '60 FPS HD (Stable)', codMobileFps: '60 FPS (Stable)', genshinFps: '40-50 FPS Medium', videoPlayback: '18 hours', gamingBattery: '7 hours', browsingBattery: '13 hours' },
  },
  {
    brand: 'Samsung', model: 'Galaxy S24 FE', slug: 'samsung-galaxy-s24-fe',
    releaseDate: '2024-09-26', pricePKR: 199999, ptaStatus: 'PTA Approved', ptaApproved: true,
    featured: false, trending: true, upcoming: false,
    thumbnail: 'https://fdn2.gsmarena.com/vv/bigpic/samsung-galaxy-s24-fe.jpg',
    description: 'Samsung Galaxy S24 FE brings flagship features like Galaxy AI to a more affordable price point.',
    cameraScore: 85, performanceScore: 82, batteryScore: 84, displayScore: 88, valueScore: 88, overallRating: 8.5,
    pros: 'Galaxy AI features,Flagship-level display,6 years updates,Good value',
    cons: 'Exynos 2400e not as fast as Snapdragon,Only 25W charging,Plastic frame',
    reviewSummary: 'The Galaxy S24 FE brings Galaxy AI features and flagship-level display quality to a more accessible price.',
    reviewVerdict: 'Best AI phone under 200K',
    specs: { displayType: 'Dynamic AMOLED 2X', display: '6.7 inches', resolution: '1080 x 2340', refreshRate: '120Hz', protection: 'Gorilla Glass Victus+', brightness: '1900 nits peak', chipset: 'Exynos 2400e', cpu: 'Deca-core (1x3.1GHz + 3x2.9GHz + 2x2.6GHz + 4x1.95GHz)', gpu: 'Xclipse 940', process: '4nm', ram: '8GB', ramType: 'LPDDR5X', storage: '128GB/256GB/512GB', cardSlot: 'microSD up to 1TB', mainCamera: '50 MP', mainCameraSensor: '50MP (f/1.8)', aperture: 'f/1.8', ois: 'Yes', eis: 'Yes', ultrawide: '12MP (f/2.2)', telephoto: '8MP (f/2.4)', zoom: '3x optical, 30x digital', cameraFeatures: 'Nightography, AI Photo Assist, Pro Visual Engine', videoRecording: '4K@60fps, 8K@30fps', selfieCamera: '10 MP', selfieSensor: '10MP (f/2.4)', selfieVideo: '4K@30fps', battery: '4700 mAh', charging: '25W wired', chargingSpeed: '50% in 30min', wirelessCharge: 'Yes', wirelessSpeed: '15W', reverseCharge: 'Yes', weight: '213g', dimensions: '162.0 x 77.7 x 8.6 mm', build: 'Plastic frame, Glass back', sim: 'Dual SIM (Nano-SIM)', ipRating: 'IP68', network: '5G', fiveG: 'Yes', wifi: 'Wi-Fi 6', bluetooth: '5.3', nfc: 'Yes', usb: 'USB-C 3.2', fingerprint: 'Optical (under display)', faceUnlock: 'Yes', sensors: 'Accelerometer, Gyro, Proximity, Compass, Barometer', colors: 'Blue, Graphite, Gray, Mint', os: 'Android', osVersion: '14', osUI: 'One UI 6.1', updatePolicy: '6 years OS updates', specialFeatures: 'Galaxy AI, Circle to Search, Live Translate' },
    benchmarks: { antutu: 1300000, geekbenchSingle: 1800, geekbenchMulti: 5000, gamingScore: 75, pubgFps: '60 FPS HD (Stable)', codMobileFps: '60 FPS (Stable)', genshinFps: '45-60 FPS Medium', videoPlayback: '18 hours', gamingBattery: '7 hours', browsingBattery: '13 hours' },
  },
  // --- Additional phones (Task 3) ---
  {
    brand: 'Samsung', model: 'Galaxy A35 5G', slug: 'samsung-galaxy-a35-5g',
    releaseDate: '2024-03-22', pricePKR: 74999, ptaStatus: 'PTA Approved', ptaApproved: true,
    featured: false, trending: false, upcoming: false,
    thumbnail: 'https://fdn2.gsmarena.com/vv/bigpic/samsung-galaxy-a35-5g.jpg',
    description: 'Samsung Galaxy A35 5G is the best mid-range Samsung phone with premium design, great cameras, and 4 years of updates.',
    cameraScore: 78, performanceScore: 65, batteryScore: 86, displayScore: 82, valueScore: 88, overallRating: 7.9,
    pros: 'IP67 water resistance,4 years updates,Good main camera,Samsung ecosystem',
    cons: 'Exynos 1380 is slow,Thick bezels,No charger in box,Only 25W charging',
    reviewSummary: 'The Galaxy A35 5G is a solid budget choice from Samsung with water resistance and long software support.',
    reviewVerdict: 'Best budget Samsung phone',
    specs: { displayType: 'Super AMOLED', display: '6.6 inches', resolution: '1080 x 2340', refreshRate: '120Hz', protection: 'Gorilla Glass Victus+', brightness: '800 nits peak', chipset: 'Exynos 1380', cpu: 'Octa-core (4x2.4GHz + 4x2.0GHz)', gpu: 'Mali-G68 MP5', process: '5nm', ram: '6GB/8GB', ramType: 'LPDDR4X', storage: '128GB/256GB', cardSlot: 'microSD up to 1TB', mainCamera: '50 MP', mainCameraSensor: '50MP (f/1.8)', aperture: 'f/1.8', ois: 'Yes', eis: 'Yes', ultrawide: '8MP (f/2.2)', telephoto: '5MP (f/2.4)', zoom: 'No optical zoom', cameraFeatures: 'Night mode, OIS, 4K Video', videoRecording: '4K@30fps, 1080p@60fps', selfieCamera: '13 MP', selfieSensor: '13MP (f/2.2)', selfieVideo: '4K@30fps', battery: '5000 mAh', charging: '25W wired', chargingSpeed: '50% in 30min', wirelessCharge: 'No', wirelessSpeed: '', reverseCharge: 'No', weight: '209g', dimensions: '161.7 x 77.4 x 8.2 mm', build: 'Glass back, Plastic frame', sim: 'Dual SIM (Nano-SIM)', ipRating: 'IP67', network: '5G', fiveG: 'Yes', wifi: 'Wi-Fi 5', bluetooth: '5.3', nfc: 'Yes', usb: 'USB-C 2.0', fingerprint: 'Optical (under display)', faceUnlock: 'Yes', sensors: 'Accelerometer, Gyro, Proximity, Compass', colors: 'Awesome Iceblue, Awesome Lilac, Awesome Lemon, Awesome Navy', os: 'Android', osVersion: '14', osUI: 'One UI 6.1', updatePolicy: '4 years OS + 5 years security', specialFeatures: 'Samsung Pay, Knox Security' },
    benchmarks: { antutu: 480000, geekbenchSingle: 780, geekbenchMulti: 2100, gamingScore: 42, pubgFps: '30-40 FPS HD (Stable)', codMobileFps: '30 FPS (Stable)', genshinFps: '20-30 FPS Low', videoPlayback: '22 hours', gamingBattery: '8 hours', browsingBattery: '15 hours' },
  },
  {
    brand: 'Xiaomi', model: 'Redmi Note 13 Pro+', slug: 'xiaomi-redmi-note-13-pro-plus',
    releaseDate: '2023-09-21', pricePKR: 54999, ptaStatus: 'PTA Approved', ptaApproved: true,
    featured: false, trending: true, upcoming: false,
    thumbnail: 'https://fdn2.gsmarena.com/vv/bigpic/xiaomi-redmi-note-13-pro-plus-5g-.jpg',
    description: 'Redmi Note 13 Pro+ is the king of mid-range with 200MP camera, 120W charging, and curved AMOLED display.',
    cameraScore: 86, performanceScore: 75, batteryScore: 90, displayScore: 90, valueScore: 94, overallRating: 8.7,
    pros: '200MP camera,120W fast charging,Beautiful curved display,IP68 water resistance',
    cons: 'Mediatek processor,Pre-installed ads,No wireless charging',
    reviewSummary: 'The Redmi Note 13 Pro+ packs flagship features like a 200MP camera and 120W charging into an affordable mid-range package.',
    reviewVerdict: 'Best mid-range camera phone',
    specs: { displayType: 'Curved AMOLED', display: '6.67 inches', resolution: '1200 x 2712', refreshRate: '120Hz', protection: 'Gorilla Glass Victus', brightness: '1800 nits peak', chipset: 'MediaTek Dimensity 7200-Ultra', cpu: 'Octa-core (2x2.8GHz + 6x2.0GHz)', gpu: 'Mali-G715', process: '4nm', ram: '8GB/12GB', ramType: 'LPDDR5', storage: '256GB/512GB', cardSlot: 'No', mainCamera: '200 MP', mainCameraSensor: '200MP Samsung ISOCELL HP3 (f/1.69)', aperture: 'f/1.69', ois: 'Yes', eis: 'Yes', ultrawide: '8MP (f/2.2)', telephoto: '2MP (f/2.4)', zoom: 'No optical zoom', cameraFeatures: '200MP mode, Night mode, AI Camera', videoRecording: '4K@30fps, 1080p@60fps', selfieCamera: '32 MP', selfieSensor: '32MP (f/2.0)', selfieVideo: '1080p@30fps', battery: '5000 mAh', charging: '120W HyperCharge', chargingSpeed: '100% in 19min', wirelessCharge: 'No', wirelessSpeed: '', reverseCharge: 'No', weight: '204g', dimensions: '161.4 x 74.2 x 8.9 mm', build: 'Glass back, Plastic frame', sim: 'Dual SIM (Nano-SIM)', ipRating: 'IP68', network: '5G', fiveG: 'Yes', wifi: 'Wi-Fi 6', bluetooth: '5.3', nfc: 'Yes', usb: 'USB-C 2.0', fingerprint: 'Optical (under display)', faceUnlock: 'Yes', sensors: 'Accelerometer, Gyro, Proximity, Compass', colors: 'Violet, Black, Purple, White', os: 'Android', osVersion: '13', osUI: 'MIUI 14', updatePolicy: '3 years OS updates', specialFeatures: 'Infrared blaster, 3.5mm jack adapter' },
    benchmarks: { antutu: 720000, geekbenchSingle: 1100, geekbenchMulti: 3000, gamingScore: 60, pubgFps: '40-60 FPS HD (Stable)', codMobileFps: '40 FPS (Stable)', genshinFps: '30 FPS Low-Medium', videoPlayback: '21 hours', gamingBattery: '8 hours', browsingBattery: '15 hours' },
  },
  {
    brand: 'Infinix', model: 'Note 40 Pro', slug: 'infinix-note-40-pro',
    releaseDate: '2024-03-18', pricePKR: 42999, ptaStatus: 'PTA Approved', ptaApproved: true,
    featured: false, trending: true, upcoming: false,
    thumbnail: 'https://fdn2.gsmarena.com/vv/bigpic/infinix-note-40-pro.jpg',
    description: 'Infinix Note 40 Pro offers wireless charging and MagSafe at a budget price, a first for the segment.',
    cameraScore: 72, performanceScore: 62, batteryScore: 92, displayScore: 80, valueScore: 96, overallRating: 8.0,
    pros: 'Wireless charging under 60K,MagSafe support,Beautiful design,Good battery life',
    cons: 'Mediatek Helio G99,Only 33W wired charging,Average performance',
    reviewSummary: 'The Infinix Note 40 Pro brings premium features like wireless charging and MagSafe to the budget segment.',
    reviewVerdict: 'Best budget phone with wireless charging',
    specs: { displayType: 'AMOLED', display: '6.78 inches', resolution: '1080 x 2436', refreshRate: '120Hz', protection: 'Corning Gorilla Glass', brightness: '1300 nits peak', chipset: 'MediaTek Helio G99', cpu: 'Octa-core (2x2.2GHz + 6x2.0GHz)', gpu: 'Mali-G57 MC2', process: '6nm', ram: '8GB', ramType: 'LPDDR4X', storage: '256GB', cardSlot: 'microSD up to 2TB', mainCamera: '108 MP', mainCameraSensor: '108MP (f/1.75)', aperture: 'f/1.75', ois: 'Yes', eis: 'Yes', ultrawide: '2MP (f/2.4)', telephoto: '', zoom: 'No optical zoom', cameraFeatures: '108MP mode, Night mode, AI Camera', videoRecording: '2K@30fps, 1080p@60fps', selfieCamera: '32 MP', selfieSensor: '32MP (f/2.0)', selfieVideo: '1080p@30fps', battery: '5000 mAh', charging: '33W wired', chargingSpeed: '55% in 30min', wirelessCharge: 'Yes', wirelessSpeed: '20W MagSafe compatible', reverseCharge: 'Yes', weight: '190g', dimensions: '164.4 x 74.1 x 7.6 mm', build: 'Glass back, Plastic frame', sim: 'Dual SIM (Nano-SIM)', ipRating: 'IP54', network: '4G', fiveG: 'No', wifi: 'Wi-Fi 5', bluetooth: '5.3', nfc: 'Yes', usb: 'USB-C 2.0', fingerprint: 'Side-mounted', faceUnlock: 'Yes', sensors: 'Accelerometer, Gyro, Proximity, Compass', colors: 'Titan Gold, Vintage Green, Obsidian Black', os: 'Android', osVersion: '14', osUI: 'XOS 14', updatePolicy: '2 years OS updates', specialFeatures: 'Wireless charging, MagSafe, JBL speakers' },
    benchmarks: { antutu: 380000, geekbenchSingle: 560, geekbenchMulti: 1800, gamingScore: 35, pubgFps: '30-40 FPS HD (Stable)', codMobileFps: '30 FPS (Stable)', genshinFps: '20-30 FPS Low', videoPlayback: '24 hours', gamingBattery: '9 hours', browsingBattery: '16 hours' },
  },
  {
    brand: 'Tecno', model: 'Spark 20 Pro', slug: 'tecno-spark-20-pro',
    releaseDate: '2024-01-15', pricePKR: 34999, ptaStatus: 'PTA Approved', ptaApproved: true,
    featured: false, trending: false, upcoming: false,
    thumbnail: 'https://fdn2.gsmarena.com/vv/bigpic/tecno-spark-20-pro.jpg',
    description: 'Tecno Spark 20 Pro delivers a 108MP camera, 90Hz display, and large battery at an incredibly low price point.',
    cameraScore: 68, performanceScore: 55, batteryScore: 90, displayScore: 75, valueScore: 96, overallRating: 7.7,
    pros: '108MP camera under 35K,Great battery life,90Hz display,Excellent value for money',
    cons: 'Helio G88 is dated,No 5G,Only 33W charging,Average build quality',
    reviewSummary: 'The Tecno Spark 20 Pro is the ultimate budget champion with a 108MP camera and excellent battery life at under 35K PKR.',
    reviewVerdict: 'Best value-for-money phone under 35K',
    specs: { displayType: 'IPS LCD', display: '6.78 inches', resolution: '1080 x 2460', refreshRate: '90Hz', protection: 'Corning Gorilla Glass 3', brightness: '500 nits peak', chipset: 'MediaTek Helio G88', cpu: 'Octa-core (2x2.0GHz + 6x1.8GHz)', gpu: 'Mali-G52 MC2', process: '12nm', ram: '8GB', ramType: 'LPDDR4X', storage: '256GB', cardSlot: 'microSD up to 1TB', mainCamera: '108 MP', mainCameraSensor: '108MP (f/1.75)', aperture: 'f/1.75', ois: 'No', eis: 'Yes', ultrawide: '2MP (f/2.4)', telephoto: '', zoom: 'No optical zoom', cameraFeatures: '108MP mode, Night mode, AI Camera, Portrait', videoRecording: '2K@30fps, 1080p@60fps', selfieCamera: '32 MP', selfieSensor: '32MP (f/2.0)', selfieVideo: '1080p@30fps', battery: '5000 mAh', charging: '33W wired', chargingSpeed: '55% in 30min', wirelessCharge: 'No', wirelessSpeed: '', reverseCharge: 'No', weight: '199g', dimensions: '168.6 x 76.5 x 8.5 mm', build: 'Glass back, Plastic frame', sim: 'Dual SIM (Nano-SIM)', ipRating: 'IP54', network: '4G', fiveG: 'No', wifi: 'Wi-Fi 5', bluetooth: '5.2', nfc: 'Yes', usb: 'USB-C 2.0', fingerprint: 'Side-mounted', faceUnlock: 'Yes', sensors: 'Accelerometer, Proximity, Compass', colors: 'Glossy White, Starry Black, Sunset Gold', os: 'Android', osVersion: '14', osUI: 'HiOS 14', updatePolicy: '2 years OS updates', specialFeatures: 'Dual speakers, DTS sound, 108MP camera' },
    benchmarks: { antutu: 250000, geekbenchSingle: 420, geekbenchMulti: 1400, gamingScore: 25, pubgFps: '25-30 FPS HD (Stable)', codMobileFps: '25-30 FPS (Stable)', genshinFps: '15-20 FPS Low', videoPlayback: '22 hours', gamingBattery: '8 hours', browsingBattery: '15 hours' },
  },
  {
    brand: 'Realme', model: 'GT 5 Pro', slug: 'realme-gt-5-pro',
    releaseDate: '2024-01-04', pricePKR: 119999, ptaStatus: 'PTA Approved', ptaApproved: true,
    featured: true, trending: false, upcoming: true,
    thumbnail: 'https://fdn2.gsmarena.com/vv/bigpic/realme-gt5-pro.jpg',
    description: 'Realme GT 5 Pro brings Snapdragon 8 Gen 3 performance at a fraction of the cost with a periscope camera.',
    cameraScore: 88, performanceScore: 95, batteryScore: 88, displayScore: 93, valueScore: 95, overallRating: 9.1,
    pros: 'Snapdragon 8 Gen 3 at great price,Periscope telephoto,Excellent display,100W charging',
    cons: 'No wireless charging,Only available in select markets,Heavy',
    reviewSummary: 'The Realme GT 5 Pro offers flagship Snapdragon 8 Gen 3 performance with a periscope camera at an incredible price point.',
    reviewVerdict: 'Best value flagship killer',
    specs: { displayType: 'LTPO AMOLED', display: '6.78 inches', resolution: '1440 x 2780', refreshRate: '120Hz', protection: 'Gorilla Glass Victus 2', brightness: '6000 nits peak', chipset: 'Snapdragon 8 Gen 3', cpu: 'Octa-core (1x3.3GHz + 5x3.2GHz + 2x2.3GHz)', gpu: 'Adreno 750', process: '4nm', ram: '8GB/12GB/16GB', ramType: 'LPDDR5X', storage: '256GB/512GB/1TB', cardSlot: 'No', mainCamera: '50 MP', mainCameraSensor: '50MP Sony LYT-808 (f/1.69)', aperture: 'f/1.69', ois: 'Yes', eis: 'Yes', ultrawide: '8MP (f/2.2)', telephoto: '50MP (f/2.6)', zoom: '3x optical', cameraFeatures: 'Periscope telephoto, Night mode, AI Camera', videoRecording: '4K@60fps, 8K@24fps', selfieCamera: '32 MP', selfieSensor: '32MP (f/2.4)', selfieVideo: '4K@30fps', battery: '5400 mAh', charging: '100W SUPERVOOC', chargingSpeed: '100% in 26min', wirelessCharge: 'No', wirelessSpeed: '', reverseCharge: 'No', weight: '218g', dimensions: '161.7 x 75.1 x 9.0 mm', build: 'Aluminum frame, Glass/Leather back', sim: 'Dual SIM (Nano-SIM)', ipRating: 'IP64', network: '5G', fiveG: 'Yes', wifi: 'Wi-Fi 7', bluetooth: '5.3', nfc: 'Yes', usb: 'USB-C 3.2', fingerprint: 'Optical (under display)', faceUnlock: 'Yes', sensors: 'Accelerometer, Gyro, Proximity, Compass', colors: 'Pioneer Green, Submarine Blue, Moon White', os: 'Android', osVersion: '14', osUI: 'Realme UI 5.0', updatePolicy: '3 years OS updates', specialFeatures: 'Infrared blaster, Alert Slider' },
    benchmarks: { antutu: 2050000, geekbenchSingle: 2200, geekbenchMulti: 6850, gamingScore: 94, pubgFps: '90 FPS (Stable)', codMobileFps: '60 FPS Max (Stable)', genshinFps: '60 FPS High Settings', videoPlayback: '21 hours', gamingBattery: '9 hours', browsingBattery: '16 hours' },
  },
];

const NEWS_DATA = [
  { title: 'Samsung Galaxy S25 Ultra Launching in Pakistan Soon', slug: 'samsung-galaxy-s25-ultra-pakistan-launch', excerpt: 'Samsung is preparing to launch the Galaxy S25 Ultra in Pakistan with Snapdragon 8 Elite chip and improved AI features.', content: 'Samsung is set to bring its next flagship, the Galaxy S25 Ultra, to Pakistani markets. The phone is expected to feature the new Snapdragon 8 Elite chipset, a redesigned camera system with improved low-light performance, and enhanced Galaxy AI capabilities. Pakistani consumers can expect PTA approval shortly after the global launch.', category: 'Launch', author: 'PhoneDock Team', published: true, featured: true, image: '' },
  { title: 'PTA Taxes Reduced on Imported Smartphones', slug: 'pta-taxes-reduced-imported-smartphones', excerpt: 'PTA has announced reduced taxes on imported smartphones, making flagship phones more affordable in Pakistan.', content: 'The Pakistan Telecommunication Authority (PTA) has announced a significant reduction in taxes on imported smartphones. This move is expected to bring down prices of popular models by 10-15%, making flagship devices from Apple, Samsung, and other brands more accessible to Pakistani consumers.', category: 'Policy', author: 'PhoneDock Team', published: true, featured: true, image: '' },
  { title: 'Best Camera Phones Under 100K PKR in 2025', slug: 'best-camera-phones-under-100k-pkr-2025', excerpt: 'Looking for the best camera phone under 100,000 PKR? Here are our top picks for photography enthusiasts on a budget.', content: 'Finding a great camera phone under 100,000 PKR is now easier than ever. Our top picks include the Realme GT 5 Pro for its periscope camera, the Xiaomi Redmi Note 13 Pro+ with its 200MP sensor, and the Tecno Camon 30 Premier with its Sony IMX890 sensor. Each offers exceptional photography capabilities without breaking the bank.', category: 'Guide', author: 'PhoneDock Team', published: true, featured: false, image: '' },
  { title: 'iPhone 16 Series Expected Price in Pakistan', slug: 'iphone-16-series-price-pakistan', excerpt: 'Apple iPhone 16 series expected prices and launch timeline for Pakistan market.', content: 'The iPhone 16 series is expected to launch in Pakistan with prices starting from PKR 329,999 for the base iPhone 16. The Pro models are expected to start from PKR 499,999. PTA approval is expected within 2-3 weeks of the global launch.', category: 'Rumors', author: 'PhoneDock Team', published: true, featured: false, image: '' },
];

async function main() {
  console.log('Seeding PhoneDock database...');

  // Create brands
  for (const b of BRANDS) {
    await db.brand.upsert({
      where: { slug: b.slug },
      update: b,
      create: b,
    });
  }
  console.log(`Created ${BRANDS.length} brands`);

  // Create phones
  for (const p of PHONES) {
    const brand = await db.brand.findUnique({ where: { slug: p.brand.toLowerCase() } });
    if (!brand) { console.error(`Brand not found: ${p.brand}`); continue; }

    const phone = await db.phone.upsert({
      where: { slug: p.slug },
      update: {
        brandId: brand.id,
        modelName: p.model,
        pricePKR: p.pricePKR,
        ptaStatus: p.ptaStatus,
        ptaApproved: p.ptaApproved,
        featured: p.featured,
        trending: p.trending,
        upcoming: p.upcoming,
        thumbnail: p.thumbnail,
        description: p.description,
        cameraScore: p.cameraScore,
        performanceScore: p.performanceScore,
        batteryScore: p.batteryScore,
        displayScore: p.displayScore,
        valueScore: p.valueScore,
        overallRating: p.overallRating,
        pros: p.pros,
        cons: p.cons,
        reviewSummary: p.reviewSummary,
        reviewVerdict: p.reviewVerdict,
        releaseDate: p.releaseDate,
      },
      create: {
        brandId: brand.id,
        modelName: p.model,
        slug: p.slug,
        pricePKR: p.pricePKR,
        ptaStatus: p.ptaStatus,
        ptaApproved: p.ptaApproved,
        featured: p.featured,
        trending: p.trending,
        upcoming: p.upcoming,
        thumbnail: p.thumbnail,
        description: p.description,
        cameraScore: p.cameraScore,
        performanceScore: p.performanceScore,
        batteryScore: p.batteryScore,
        displayScore: p.displayScore,
        valueScore: p.valueScore,
        overallRating: p.overallRating,
        pros: p.pros,
        cons: p.cons,
        reviewSummary: p.reviewSummary,
        reviewVerdict: p.reviewVerdict,
        releaseDate: p.releaseDate,
      },
    });

    // Create specs
    if (p.specs) {
      await db.phoneSpecs.upsert({
        where: { phoneId: phone.id },
        update: { phoneId: phone.id, ...p.specs },
        create: { phoneId: phone.id, ...p.specs },
      });
    }

    // Create benchmarks
    if (p.benchmarks) {
      await db.phoneBenchmark.upsert({
        where: { phoneId: phone.id },
        update: { phoneId: phone.id, ...p.benchmarks },
        create: { phoneId: phone.id, ...p.benchmarks },
      });
    }

    // Create default images
    await db.phoneImage.deleteMany({ where: { phoneId: phone.id } });
    await db.phoneImage.create({
      data: { phoneId: phone.id, url: p.thumbnail, altText: `${p.model} - Front View`, sortOrder: 0 },
    });

    // Create default store prices
    await db.phonePrice.deleteMany({ where: { phoneId: phone.id } });
    await db.phonePrice.createMany({
      data: [
        { phoneId: phone.id, storeName: 'Daraz', price: Math.round(p.pricePKR * 0.98), url: '#', inStock: true },
        { phoneId: phone.id, storeName: 'Whatmobile', price: p.pricePKR, url: '#', inStock: true },
        { phoneId: phone.id, storeName: 'PriceOye', price: Math.round(p.pricePKR * 1.02), url: '#', inStock: true },
      ],
    });
  }
  console.log(`Created ${PHONES.length} phones with specs, benchmarks, images, and prices`);

  // Create news
  for (const n of NEWS_DATA) {
    await db.news.upsert({
      where: { slug: n.slug },
      update: n,
      create: n,
    });
  }
  console.log(`Created ${NEWS_DATA.length} news articles`);

  // Create admin user
  const hashedPassword = await hash('admin123', 12);
  await db.admin.upsert({
    where: { email: 'admin@phonedock.pk' },
    update: {},
    create: { email: 'admin@phonedock.pk', password: hashedPassword, name: 'Admin', role: 'superadmin' },
  });
  console.log('Created admin user (admin@phonedock.pk / admin123)');

  console.log('Database seeded successfully!');
}

main()
  .catch(console.error)
  .finally(() => db.$disconnect());