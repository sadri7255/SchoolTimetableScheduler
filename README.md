# سامانه هوشمند تنظیم برنامه هفتگی مدارس

<div align="center">

[![Live Demo](https://img.shields.io/badge/Live_Demo-مشاهده_دموی_زنده-28a745?style=for-the-badge)](https://sadri7255.github.io/SchoolTimetableScheduler/)

</div>

![بنر سامانه برنامه هفتگی](https://s6.uupload.ir/files/صفحه_اصلی_6qi7.png)

<div align="center">

![HTML5](https://img.shields.io/badge/HTML5-%23E34F26.svg?style=for-the-badge&logo=html5&logoColor=white)
![CSS3](https://img.shields.io/badge/CSS3-%231572B6.svg?style=for-the-badge&logo=css3&logoColor=white)
![JavaScript](https://img.shields.io/badge/JavaScript-%23F7DF1E.svg?style=for-the-badge&logo=javascript&logoColor=black)

</div>

یک اپلیکیشن تحت وب جامع و تعاملی برای ساخت، مدیریت و بهینه‌سازی برنامه هفتگی مدارس. این سامانه با استفاده از تکنولوژی‌های مدرن وب و بدون نیاز به سرور (Server-less) طراحی شده و تمام اطلاعات را به صورت امن روی مرورگر کاربر ذخیره می‌کند.

---

## 🎯 ویژگی‌های کلیدی

این سامانه مجموعه‌ای کامل از ابزارها را برای مدیران و معاونین آموزشی فراهم می‌کند:

-   **رابط کاربری کشیدن و رها کردن (Drag & Drop):** به راحتی دروس را از لیست دروس تخصیص نیافته به جدول برنامه منتقل کنید.
-   **پشتیبانی از دو هفته (الف و ب):** برنامه‌های متفاوت برای هفته‌های زوج و فرد تعریف کنید و به سادگی بین آن‌ها جابجا شوید.
-   **ورود و خروج اطلاعات:**
    -   **ورود از اکسل:** لیست دبیران و دروس را به سادگی از یک فایل اکسل وارد سامانه کنید.
    -   **پشتیبان‌گیری و بازیابی:** از کل اطلاعات برنامه (شامل دروس، دبیران، کلاس‌ها و جدول‌ها) در قالب یک فایل JSON خروجی بگیرید و در هر زمان آن را بازیابی کنید.
-   **خروجی‌های متنوع:**
    -   خروجی **PDF** و **PNG** از نمای کلی برنامه یا برنامه هر دبیر.
    -   خروجی **Excel** از کل برنامه هفتگی.
    -   قابلیت **چاپ** مستقیم برنامه.
-   **اعتبارسنجی و تشخیص تداخل:**
    -   تشخیص هوشمند **تداخل برنامه دبیران** (حضور همزمان یک دبیر در دو کلاس).
    -   تشخیص **تداخل اتاق‌ها** (استفاده همزمان از یک اتاق خاص مانند آزمایشگاه).
-   **مدیریت پیشرفته:**
    -   **ادغام زنگ‌ها:** زنگ‌های متوالی را برای دروس چندساعته با یک کلیک ادغام کنید.
    -   **چیدمان خودکار:** دروس باقی‌مانده را به صورت هوشمند در خانه‌های خالی جدول قرار دهید.
    -   **هایلایت هوشمند:** دروس را بر اساس دبیر، کلاس یا اتاق خاص هایلایت کنید تا بررسی برنامه ساده‌تر شود.
    -   **تعریف محدودیت:** زمان‌های خاصی را برای یک دبیر یا کلاس قفل کنید تا در آن زمان درسی قرار نگیرد.
-   **شخصی‌سازی:**
    -   پشتیبانی از **تم تاریک و روشن**.
    -   قابلیت **بزرگ‌نمایی** جدول برای نمایش بهتر روی صفحه‌های مختلف.
-   **ذخیره‌سازی مداوم:** تمام تغییرات به صورت خودکار در حافظه مرورگر (LocalStorage) ذخیره می‌شوند و با بستن صفحه از بین نمی‌روند.

---

## 📸 تصاویر سامانه

| نمای کلی برنامه مدرسه | نمونه برنامه تکمیل شده |
| :--------------------: | :-----------------: |
| ![تصویر نمای کلی برنامه](https://s6.uupload.ir/files/صفحه_اصلی_6qi7.png) | ![نمونه برنامه](https://s6.uupload.ir/files/نمونه_برنامه_ed9j.png) |

| پنجره تنظیمات | انواع خروجی‌ها |
| :--------------------: | :-----------------: |
| ![تصویر پنجره تنظیمات](https://s6.uupload.ir/files/پنجره_تنظیمات_phi6.png) | ![دکمه های انواع خروجی](https://s6.uupload.ir/files/انواع_خروجی_ها_ub4i.png) |

---

## 🛠️ تکنولوژی‌های استفاده شده

-   **Frontend:** HTML5, CSS3, JavaScript (ES6+)
-   **کتابخانه‌ها:**
    -   [Font Awesome](https://fontawesome.com/) برای آیکون‌ها
    -   [SheetJS (xlsx)](https://sheetjs.com/) برای کار با فایل‌های اکسل
    -   [html2canvas](https://html2canvas.hertzen.com/) برای گرفتن خروجی تصویری
    -   [jsPDF](https://github.com/parallax/jsPDF) برای ساخت فایل PDF

---

## 🚀 راه‌اندازی و استفاده

این پروژه به هیچ‌گونه ابزار ساخت (Build Tool) یا سرور نیازی ندارد. برای اجرای آن کافیست:

1.  این مخزن (Repository) را Clone کنید:
    ```bash
    git clone [https://github.com/sadri7255/SchoolTimetableScheduler.git](https://github.com/sadri7255/SchoolTimetableScheduler.git)
    ```

2.  وارد پوشه پروژه شوید.
3.  فایل `index.html` را در مرورگر خود باز کنید.

تمام! سامانه آماده استفاده است.

---

## 👨‍💻 درباره سازنده

<div dir="rtl" align="center">
  <table style="border: 1px solid #ddd; border-radius: 12px; padding: 20px; width: 80%; max-width: 600px; margin: 20px auto; background-color: #f8f9fa; box-shadow: 0 4px 8px rgba(0,0,0,0.05);">
    <tr>
      <td align="center">
        <img src="https://avatars.githubusercontent.com/u/129892053?s=400&u=a8f6b97dfea9c274b5fccca8094b9a74267e48c8&v=4" width="120px;" style="border-radius: 50%; border: 4px solid #4a69bd;" alt="تصویر پروفایل سیدمحمدکاظم صدری شال"/>
        <h2 style="margin-top: 15px; margin-bottom: 5px; color: #1e3799;">سیدمحمدکاظم صدری شال</h2>
        <p style="margin: 0; color: #555;">ایده‌پرداز، طراح و توسعه‌دهنده سامانه</p>
      </td>
    </tr>
    <tr>
      <td align="center" style="padding-top: 20px;">
        <p style="font-weight: bold; margin-bottom: 10px;">راه‌های ارتباطی:</p>
        <a href="https://t.me/sadri1993" style="text-decoration: none; margin: 0 10px;">
          <img src="https://img.shields.io/badge/Telegram-2CA5E0?style=for-the-badge&logo=telegram&logoColor=white" alt="تلگرام"/>
        </a>
        <a href="https://eitaa.com/sadri_1993" style="text-decoration: none; margin: 0 10px;">
          <img src="https://img.shields.io/badge/Eitaa-4E85C7?style=for-the-badge&logo=eitaa&logoColor=white" alt="ایتا"/>
        </a>
        <a href="tel:09386280750" style="text-decoration: none; margin: 0 10px;">
          <img src="https://img.shields.io/badge/Call-4CAF50?style=for-the-badge&logo=phone&logoColor=white" alt="شماره تماس"/>
        </a>
      </td>
    </tr>
  </table>
</div>

---

## 🤝 مشارکت

از هرگونه مشارکت در این پروژه استقبال می‌شود. اگر ایده‌ای برای بهبود سامانه دارید یا با مشکلی مواجه شدید، لطفاً یک `Issue` جدید ثبت کنید یا یک `Pull Request` ارسال نمایید.

## 📄 مجوز (License)

این پروژه تحت مجوز MIT منتشر شده است.
