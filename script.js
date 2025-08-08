/**
 * School Timetable Scheduler
 * A comprehensive, interactive, and persistent single-page application 
 * for creating and managing school timetables.
 *
 * @version 16.0.0
 * @author Gemini & S.M.Kazem Sadri
 *
 * Changelog v16.0.0:
 * - LOGIC CHANGE: Teacher load calculation now considers merged cells. If a lesson is placed in a merged slot, its duration is based on the size of the slot, not the lesson's properties.
 * - FIX: Resolved a rendering bug in the Settings modal where tab content would sometimes not appear. Content is now reliably re-rendered on tab switch.
 * - UI/UX FIX: Improved sidebar section collapse behavior. Collapsing one section now correctly allocates the freed space to the other.
 * - UI/UX FIX: The "Unplaced Lessons" list now maintains a minimum height and displays a helper message when empty, ensuring it's always a valid drop target.
 */
document.addEventListener('DOMContentLoaded', () => {
    // --- 1. DOM Element Cache ---
    const getEl = (id) => document.getElementById(id);
    const DOMElements = {
        body: document.body,
        appContainer: getEl('app-container'),
        teacherSelector: getEl('teacher-selector'),
        teacherSelectorContainer: getEl('teacher-selector-container'),
        lessonsListEl: getEl('unplaced-lessons-list'),
        fullSchoolViewEl: getEl('full-school-view'),
        teacherViewEl: getEl('teacher-view'),
        loadingSpinner: getEl('loading-spinner'),
        teacherLoadListEl: getEl('teacher-load-list'),
        conflictTooltip: getEl('conflict-tooltip'),
        validationPanel: getEl('validation-panel'),
        statsContainer: getEl('stats-container'),
        conflictsContainer: getEl('conflicts-container'),
        mergeToolBtn: getEl('merge-tool-btn'),
        copyToWeekBBtn: getEl('copy-to-week-b-btn'),
        zoomSlider: getEl('zoom-slider'),
    };

    // --- 2. Application State ---
    let state = {};
    let backupInterval;

    const setDefaultState = () => {
        state = {
            teachers: [],
            lessons: [],
            classes: [],
            rooms: [],
            constraints: { unavailable: [] },
            schedule: { A: {}, B: {} },
            merges: { A: [], B: [] }, 
            changeLog: [], 
            lessonColors: {},
            fieldColors: {},
            activeHighlights: [], // Changed from object to array
            draggedElementInfo: null,
            activeWeek: 'A',
            activeView: 'full',
            isMergeMode: false,
            mergeSelection: [],
            settings: {
                bwPrint: false,
                integratedView: false,
            }
        };
    };

    // --- 3. Utility Functions ---
    const toPersianNumber = (n) => n != null ? n.toString().replace(/\d/g, d => '۰۱۲۳۴۵۶۷۸۹' [d]) : '';
    const showLoading = (isLoading) => DOMElements.loadingSpinner.classList.toggle('hidden', !isLoading);
    const getPersianTypeName = (type) => ({
        'teacher': 'دبیر',
        'lesson': 'درس',
        'class': 'کلاس',
        'room': 'اتاق'
    })[type] || '';
    const cleanName = (name) => name ? name.toString().replace(/^\d+-\s*/, '') : '';
    
    const hexToRgb = (hex) => {
        const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
        return result ? {
            r: parseInt(result[1], 16),
            g: parseInt(result[2], 16),
            b: parseInt(result[3], 16)
        } : null;
    };

    const generateColorFromString = (str) => {
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            hash = str.charCodeAt(i) + ((hash << 5) - hash);
        }
        let color = '#';
        for (let i = 0; i < 3; i++) {
            const value = (hash >> (i * 8)) & 0xFF;
            color += `00${(value & 0x7F | 0x80).toString(16)}`.slice(-2);
        }
        return color;
    };

    const showToast = (message, type = 'info', duration = 5000, customHTML = '') => {
        const toastContainer = getEl('toast-container');
        if (!toastContainer) return;
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        toast.innerHTML = message.replace(/\n/g, '<br>') + customHTML;
        toastContainer.appendChild(toast);
        setTimeout(() => {
            toast.style.opacity = '0';
            setTimeout(() => toast.remove(), 500);
        }, duration);
    };

    const showConfirm = (title, text) => {
        getEl('confirm-title').textContent = title;
        getEl('confirm-text').textContent = text;
        const confirmModal = getEl('confirm-modal');
        confirmModal.style.display = 'flex';
        return new Promise((resolve) => {
            getEl('confirm-yes-btn').onclick = () => {
                confirmModal.style.display = 'none';
                resolve(true);
            };
            getEl('confirm-no-btn').onclick = () => {
                confirmModal.style.display = 'none';
                resolve(false);
            };
        });
    };
    
    const logChange = (description) => {
        state.changeLog.unshift({
            time: new Date().toISOString(),
            description
        });
        if(state.changeLog.length > 100) {
            state.changeLog.pop();
        }
    };

    const findKey = (row, possibleKeys) => {
        const rowKeys = Object.keys(row).map(k => k.trim().toLowerCase());
        for (const pKey of possibleKeys) {
            const keyIndex = rowKeys.indexOf(pKey.toLowerCase());
            if (keyIndex !== -1) {
                return Object.keys(row)[keyIndex];
            }
        }
        return null;
    };

    // --- 4. Core Application Logic ---
    function initializeApp() {
        showLoading(true);
        try {
            loadState();
            setupEventListeners();
            renderAll();
            switchView(state.activeView || 'full');
            startBackupReminder();
        } catch (error) {
            console.error("Initialization failed:", error);
            DOMElements.fullSchoolViewEl.innerHTML = `<div class="empty-state"><h3>خطای بحرانی</h3><p>یک خطای غیرمنتظره در برنامه رخ داده است. لطفاً صفحه را رفرش کنید.</p><p style="font-size: 0.8rem; color: #e74c3c;">${error.message}</p></div>`;
        } finally {
            showLoading(false);
        }
    }

    // --- 5. Data Persistence & I/O ---
    const saveState = () => {
        try {
            localStorage.setItem('schoolScheduleData_v16', JSON.stringify(state));
        } catch (error) {
            console.error("Failed to save state:", error);
            showToast("خطا در ذخیره‌سازی اطلاعات.", "error");
        }
    };

    const loadState = () => {
        const savedState = localStorage.getItem('schoolScheduleData_v16') || localStorage.getItem('schoolScheduleData_v15') || localStorage.getItem('schoolScheduleData_v14') || localStorage.getItem('schoolScheduleData_v13') || localStorage.getItem('schoolScheduleData_v12') || localStorage.getItem('schoolScheduleData_v11') || localStorage.getItem('schoolScheduleData_v10');
        setDefaultState();
        if (savedState) {
            const loaded = JSON.parse(savedState);
            state = {
                ...state,
                ...loaded,
                schedule: loaded.schedule || { A: {}, B: {} },
                merges: loaded.merges || { A: [], B: [] },
                changeLog: loaded.changeLog || [],
                constraints: loaded.constraints || { unavailable: [] },
                activeHighlights: loaded.activeHighlights || [],
                settings: { ...state.settings, ...(loaded.settings || {}) }
            };
        }
        assignAllColors();
        const themeToggle = getEl('theme-toggle');
        if (localStorage.getItem('theme') === 'dark') {
            DOMElements.body.classList.replace('light-theme', 'dark-theme');
            if (themeToggle) themeToggle.checked = true;
        }
        const bwPrintToggle = getEl('bw-print-toggle');
        if (bwPrintToggle) {
            bwPrintToggle.checked = state.settings.bwPrint;
            DOMElements.body.classList.toggle('bw-print', state.settings.bwPrint);
        }
        const integratedViewToggle = getEl('integrated-view-toggle');
        if (integratedViewToggle) {
            integratedViewToggle.checked = state.settings.integratedView;
            DOMElements.appContainer.classList.toggle('integrated-view', state.settings.integratedView);
        }
    };

    const processExcelData = (file, processFunction) => {
        if (!file) return;
        showLoading(true);
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const data = new Uint8Array(e.target.result);
                const workbook = XLSX.read(data, { type: 'array' });
                const worksheet = workbook.Sheets[workbook.SheetNames[0]];
                const json = XLSX.utils.sheet_to_json(worksheet);
                processFunction(json);
                logChange(`ورود اطلاعات از فایل اکسل: ${file.name}`);
                saveState();
                renderAll();
                getEl('settings-modal').style.display = 'none';
            } catch (error) {
                showToast('خطا در پردازش فایل. لطفاً از صحت فرمت و ستون‌های فایل اطمینان حاصل کنید.', 'error');
                console.error("Excel import error:", error);
            } finally {
                showLoading(false);
            }
        };
        reader.readAsArrayBuffer(file);
    };

    const importTeachers = (data) => {
        let newCount = 0;
        data.forEach(row => {
            const idKey = findKey(row, ['کد پرسنلی']);
            const nameKey = findKey(row, ['نام']);
            const familyKey = findKey(row, ['نام خانوادگی']);
            if (!idKey || !nameKey || !familyKey) return;
            const id = row[idKey]?.toString().trim();
            const name = `${row[nameKey] || ''} ${row[familyKey] || ''}`.trim();
            if (!id || !name) return;
            if (!state.teachers.some(t => t.id === id)) {
                state.teachers.push({ id, name });
                newCount++;
            }
        });
        showToast(`${toPersianNumber(newCount)} دبیر جدید با موفقیت اضافه شد.`, 'success');
    };

    const importLessonsAndClasses = (data) => {
        let newLessons = 0, newClasses = 0;
        const warnings = new Set();

        data.forEach((row, index) => {
            const classKey = findKey(row, ['کلاس']);
            const lessonKey = findKey(row, ['نام درس']);
            const teacherIdKey = findKey(row, ['کد پرسنلی']);
            const periodsKey = findKey(row, ['تعداد زنگ']);
            const fieldKey = findKey(row, ['رشته']);

            if (!classKey || !lessonKey || !teacherIdKey) return;

            const className = row[classKey]?.toString().trim();
            const lessonName = row[lessonKey]?.toString().trim();
            const teacherId = row[teacherIdKey]?.toString().trim();
            const periods = periodsKey ? parseInt(row[periodsKey]) : 1;
            const field = fieldKey ? row[fieldKey]?.toString().trim() : 'عمومی';

            if (!className || !lessonName || !teacherId) return;

            if (!state.teachers.some(t => t.id === teacherId)) {
                warnings.add(`دبیر با کد پرسنلی ${teacherId} یافت نشد. درس "${lessonName}" برای کلاس "${className}" وارد نشد.`);
                return;
            }

            let classData = state.classes.find(c => c.name === className);
            if (!classData) {
                classData = { id: `c${Date.now()}${Math.random()}`, name: className, field: field };
                state.classes.push(classData);
                if (!state.schedule.A[classData.id]) state.schedule.A[classData.id] = {};
                if (!state.schedule.B[classData.id]) state.schedule.B[classData.id] = {};
                newClasses++;
            } else if (field && !classData.field) {
                classData.field = field;
            }

            state.lessons.push({
                id: `l${Date.now()}${Math.random()}${index}`,
                name: lessonName,
                teacherId: teacherId,
                classId: classData.id,
                roomId: null,
                periods: !isNaN(periods) && periods > 0 ? periods : 1
            });
            newLessons++;
        });

        if (warnings.size > 0) {
            showToast(`چندین هشدار:\n${Array.from(warnings).join('\n')}`, 'warning', 8000);
        }
        
        assignAllColors();
        showToast(`${toPersianNumber(newClasses)} کلاس و ${toPersianNumber(newLessons)} درس جدید با موفقیت اضافه شدند.`, 'success');
    };

    // --- 6. UI Rendering ---
    const renderAll = () => {
        try {
            renderUnplacedLessonsList();
            populateTeacherDropdown();
            renderTeacherLoad();
            refreshCurrentView();
            runValidation();
        } catch (error) {
            console.error("Full render failed:", error);
            const viewContainer = getEl(state.activeView === 'full' ? 'full-school-view' : 'teacher-view');
            if (viewContainer) {
                viewContainer.innerHTML = `<div class="empty-state"><h3>خطا در نمایش برنامه</h3><p>یک خطای غیرمنتظره در رندر کردن اطلاعات رخ داد.</p><p style="font-size: 0.8rem; color: #e74c3c;">${error.message}</p></div>`;
            }
        }
    };

    const renderUnplacedLessonsList = () => {
        if (!DOMElements.lessonsListEl) return;
        const searchTerm = getEl('lesson-search').value.toLowerCase();

        const scheduledLessonIds = new Set(
            Object.values(state.schedule.A).flatMap(Object.values).flatMap(slot => slot.map(l => l.lessonId))
            .concat(Object.values(state.schedule.B).flatMap(Object.values).flatMap(slot => slot.map(l => l.lessonId)))
        );

        const lessonsToShow = state.lessons.filter(lesson => !scheduledLessonIds.has(lesson.id));

        const filteredLessons = lessonsToShow.filter(lesson => {
            const teacher = state.teachers.find(t => t.id === lesson.teacherId);
            const lessonClass = state.classes.find(c => c.id === lesson.classId);
            return (cleanName(lesson.name).toLowerCase().includes(searchTerm) ||
                (teacher && teacher.name.toLowerCase().includes(searchTerm)) ||
                (lessonClass && cleanName(lessonClass.name).toLowerCase().includes(searchTerm)));
        });

        renderList(DOMElements.lessonsListEl, filteredLessons.sort((a, b) => a.name.localeCompare(b.name)), 'lesson');
    };

    const renderList = (element, items, type) => {
        if (!element) return;
        element.innerHTML = '';
        if (items.length === 0 && type !== 'lesson') { // Keep drop target for lessons
            element.innerHTML = `<p class="empty-list-text">موردی برای نمایش وجود ندارد.</p>`;
            return;
        }
        items.forEach(item => {
            const el = document.createElement('div');
            el.className = 'list-item';
            el.dataset.id = item.id;
            el.dataset.type = type;

            if (type === 'lesson') {
                el.classList.add('draggable');
                el.draggable = true;
                el.style.borderRightColor = state.lessonColors[item.id] || '#ccc';
            }

            const teacher = type === 'lesson' ? state.teachers.find(t => t.id === item.teacherId) : null;
            const lessonClass = type === 'lesson' ? state.classes.find(c => c.id === item.classId) : null;
            const periodsText = (item.periods > 1) ? ` (${toPersianNumber(item.periods)} زنگ)` : '';

            el.innerHTML = `
                <div>
                    <div class="item-name">${cleanName(item.name)}${periodsText}</div>
                    ${lessonClass ? `<div class="class-name-sidebar">${cleanName(lessonClass.name)}</div>` : ''}
                    ${teacher ? `<div class="teacher-name">${teacher.name}</div>` : ''}
                </div>
                <div class="item-controls">
                    <button class="edit-btn" title="ویرایش"><i class="fas fa-edit"></i></button>
                    <button class="delete-btn" title="حذف"><i class="fas fa-trash"></i></button>
                </div>`;
            element.appendChild(el);
        });
    };

    const renderTeacherLoad = () => {
        if (!DOMElements.teacherLoadListEl) return;
        DOMElements.teacherLoadListEl.innerHTML = '';
        const load = {};
        const HOUR_MULTIPLIER = 2;

        state.teachers.forEach(teacher => {
            load[teacher.id] = { name: teacher.name, placed: 0, total: 0 };
        });

        state.lessons.forEach(lesson => {
            if(load[lesson.teacherId]) {
                load[lesson.teacherId].total += (lesson.periods * HOUR_MULTIPLIER);
            }
        });

        // New calculation logic based on placement
        Object.entries(state.schedule[state.activeWeek]).forEach(([classId, classSchedule]) => {
            Object.entries(classSchedule).forEach(([key, slot]) => {
                slot.forEach(entry => {
                    if (entry.isStart) {
                        const lesson = state.lessons.find(l => l.id === entry.lessonId);
                        if (lesson && lesson.teacherId && load[lesson.teacherId]) {
                            const [day, periodStr] = key.split('_');
                            const startPeriod = parseInt(periodStr);

                            // Check if this lesson starts in a merged cell
                            const mergeInfo = state.merges[state.activeWeek].find(m => 
                                m.classId === classId && 
                                m.day === day && 
                                m.startPeriod === startPeriod
                            );
                            
                            // If it's in a merged cell, the duration is the cell's size. Otherwise, it's the lesson's own duration.
                            const occupiedPeriods = mergeInfo ? mergeInfo.count : lesson.periods;
                            load[lesson.teacherId].placed += (occupiedPeriods * HOUR_MULTIPLIER);
                        }
                    }
                });
            });
        });

        const sortedTeachers = Object.values(load).sort((a, b) => a.name.localeCompare(b.name));
        if (sortedTeachers.length === 0) {
            DOMElements.teacherLoadListEl.innerHTML = `<p class="empty-list-text">دبیری تعریف نشده است.</p>`;
            return;
        }
        sortedTeachers.forEach(t => {
            const item = document.createElement('div');
            item.className = 'teacher-load-item';
            const placedText = toPersianNumber(t.placed);
            const totalText = toPersianNumber(t.total);
            item.innerHTML = `<span>${t.name}</span>
                              <span>
                                ${placedText} <span class="total-load">/ ${totalText}</span>
                              </span>`;
            DOMElements.teacherLoadListEl.appendChild(item);
        });
    };

    const populateTeacherDropdown = () => {
        const currentVal = DOMElements.teacherSelector.value;
        DOMElements.teacherSelector.innerHTML = '';
        state.teachers.sort((a, b) => a.name.localeCompare(b.name)).forEach(t => {
            const option = document.createElement('option');
            option.value = t.id;
            option.textContent = t.name;
            DOMElements.teacherSelector.appendChild(option);
        });
        DOMElements.teacherSelector.value = state.teachers.find(t => t.id === currentVal) ? currentVal : (state.teachers[0]?.id || '');
    };

    const renderFullSchedule = () => {
        const container = DOMElements.fullSchoolViewEl;
        if (state.classes.length === 0) {
            container.innerHTML = `<div class="empty-state"><h3>به سامانه برنامه‌ریزی خوش آمدید!</h3><p>برای شروع، از بخش تنظیمات، داده‌های اولیه (دبیران و دروس) را وارد کنید.</p><button class="panel-btn" id="go-to-settings-btn"><i class="fas fa-cog"></i> رفتن به تنظیمات</button></div>`;
            return;
        }
    
        const days = ['شنبه', 'یکشنبه', 'دوشنبه', 'سه‌شنبه', 'چهارشنبه', 'پنج‌شنبه'];
        const periods = 4;
        const sortedClasses = state.classes.sort((a, b) => a.name.localeCompare(b.name));
        let tableHTML = `<div class="schedule-container" id="schedule-to-export"><table class="schedule-table">`;
    
        tableHTML += `<thead><tr><th class="class-header sticky-col">کلاس</th>${days.map(day => `<th class="day-header" colspan="${periods}">${day}</th>`).join('')}</tr><tr><th class="class-header sticky-col"></th>`;
        days.forEach((day, dayIndex) => {
            for (let i = 1; i <= periods; i++) {
                const separatorClass = (i === periods && dayIndex < days.length - 1) ? 'day-separator' : '';
                tableHTML += `<th class="period-header ${separatorClass}">${toPersianNumber(i)}</th>`;
            }
        });
        tableHTML += '</tr></thead><tbody>';
    
        sortedClasses.forEach(c => {
            const fieldColor = state.fieldColors[c.field] || '#ffffff';
            const fieldColorRgb = hexToRgb(fieldColor);
            const rgbString = fieldColorRgb ? `${fieldColorRgb.r}, ${fieldColorRgb.g}, ${fieldColorRgb.b}` : '255, 255, 255';
            
            tableHTML += `<tr style="--field-color-rgb: ${rgbString};"><th class="class-header sticky-col"><div>${cleanName(c.name)}</div></th>`;
            
            const renderedPeriods = new Set();
            days.forEach((day, dayIndex) => {
                for (let period = 1; period <= periods; period++) {
                    if (renderedPeriods.has(`${day}_${period}`)) continue;

                    const key = `${day}_${period}`;
                    const mergeInfo = state.merges[state.activeWeek]?.find(m => m.classId === c.id && m.day === day && m.startPeriod === period);
                    const slotContent = state.schedule[state.activeWeek]?.[c.id]?.[key];
                    
                    let colspan = 1;
                    if (mergeInfo) {
                        colspan = mergeInfo.count;
                    } else if (slotContent && slotContent.length > 0) {
                        // Find the lesson that starts here to determine colspan
                        const startEntry = slotContent.find(entry => entry.isStart);
                        if (startEntry) {
                            const firstLesson = state.lessons.find(l => l.id === startEntry.lessonId);
                            if (firstLesson) {
                                colspan = firstLesson.periods;
                            }
                        }
                    }

                    const separatorClass = (period + colspan - 1 === periods && dayIndex < days.length - 1) ? 'day-separator' : '';
                    
                    let innerHTML = '';
                    if (slotContent && slotContent.length > 0) {
                        innerHTML = '<div class="shared-slot-container">';
                        slotContent.forEach(entry => {
                            if (entry.isStart) { // Only render the cell for the starting period of a lesson
                                innerHTML += createLessonCellHTML(entry.lessonId, day, period, c.id);
                            }
                        });
                        innerHTML += '</div>';
                    }

                    tableHTML += createDropZoneHTML(c.id, day, period, colspan, separatorClass, innerHTML);

                    for (let i = 1; i < colspan; i++) {
                        renderedPeriods.add(`${day}_${period + i}`);
                    }
                }
            });
            tableHTML += `</tr>`;
        });
        tableHTML += '</tbody></table></div>';
        container.innerHTML = tableHTML;
    };
    
    const renderTeacherSchedule = (teacherId) => {
        const container = DOMElements.teacherViewEl;
        if (!teacherId) {
            container.innerHTML = `<div class="schedule-container empty-state"><p>دبیری انتخاب نشده است.</p></div>`;
            return;
        }
        const teacher = state.teachers.find(t => t.id === teacherId);
        const days = ['شنبه', 'یکشنبه', 'دوشنبه', 'سه‌شنبه', 'چهارشنبه', 'پنج‌شنبه'];
        const periods = 4;
        
        let tableHTML = `<div class="schedule-container" id="schedule-to-export"><h3 class="view-title">برنامه هفتگی دبیر: ${teacher.name}</h3><table class="schedule-table"><thead><tr><th>زنگ / روز</th>${days.map(day => `<th>${day}</th>`).join('')}</tr></thead><tbody>`;

        for (let period = 1; period <= periods; period++) {
            tableHTML += `<tr><td class="period-label">زنگ ${toPersianNumber(period)}</td>`;
            days.forEach(day => {
                const key = `${day}_${period}`;
                let cellContent = '';
                for (const classId in state.schedule[state.activeWeek]) {
                    const slot = state.schedule[state.activeWeek][classId][key];
                    if (slot) {
                        slot.forEach(entry => {
                            const lesson = state.lessons.find(l => l.id === entry.lessonId);
                            if (lesson && lesson.teacherId === teacherId) {
                                const className = state.classes.find(c => c.id === classId)?.name || '';
                                cellContent += `<div class="lesson-in-table" style="background-color:${state.lessonColors[lesson.id]}"><span class="lesson-name-cell">${cleanName(lesson.name)}</span><span class="teacher-name-cell">${cleanName(className)}</span></div>`;
                            }
                        });
                    }
                }
                tableHTML += `<td><div class="shared-slot-container">${cellContent}</div></td>`;
            });
            tableHTML += '</tr>';
        }
        tableHTML += '</tbody></table></div>';
        container.innerHTML = tableHTML;
    };

    const createDropZoneHTML = (classId, day, period, colspan = 1, separatorClass = '', innerHTML = '') => {
        const isLocked = isSlotLocked({ classId, day, period: parseInt(period) });
        const key = `${day}_${period}`;
        return `<td class="drop-zone ${isLocked ? 'locked-slot' : ''} ${separatorClass}" data-day="${day}" data-period="${period}" data-class-id="${classId}" data-key="${key}" colspan="${colspan}">${innerHTML}</td>`;
    };

    const createLessonCellHTML = (lessonId, day, period, classId) => {
        const lesson = state.lessons.find(l => l.id === lessonId);
        if (!lesson) return '';
        const teacher = state.teachers.find(t => t.id === lesson.teacherId);
        const conflictDetails = checkForConflict(lesson, day, parseInt(period), classId);
        
        const isHighlighted = state.activeHighlights.some(h => 
            (h.type === 'teacher' && lesson.teacherId === h.id) ||
            (h.type === 'class' && lesson.classId === h.id) ||
            (h.type === 'room' && lesson.roomId === h.id)
        );

        return `<div class="lesson-in-table ${conflictDetails ? 'conflict' : ''} ${isHighlighted ? 'highlighted-lesson' : ''}" draggable="true" data-lesson-id="${lesson.id}" data-conflict='${conflictDetails ? JSON.stringify(conflictDetails) : ''}' style="background-color: ${state.lessonColors[lesson.id]}"><span class="lesson-name-cell">${cleanName(lesson.name)}</span><span class="teacher-name-cell">${teacher ? teacher.name : 'بی‌نام'}</span></div>`;
    };

    // --- 7. Event Handling ---
    function setupEventListeners() {
        document.body.addEventListener('click', handleGlobalClick);
        getEl('lesson-search').addEventListener('input', renderUnplacedLessonsList);
        getEl('import-teachers-btn').addEventListener('click', () => getEl('import-teachers-input').click());
        getEl('import-lessons-btn').addEventListener('click', () => getEl('import-lessons-input').click());
        getEl('import-teachers-input').addEventListener('change', (e) => { processExcelData(e.target.files[0], importTeachers); e.target.value = null; });
        getEl('import-lessons-input').addEventListener('change', (e) => { processExcelData(e.target.files[0], importLessonsAndClasses); e.target.value = null; });
        getEl('restore-input').addEventListener('change', handleRestore);
        document.addEventListener('dragstart', handleDragStart);
        document.addEventListener('dragend', handleDragEnd);
        document.addEventListener('dragover', handleDragOver);
        document.addEventListener('dragleave', handleDragLeave);
        document.addEventListener('drop', handleDrop);
        DOMElements.lessonsListEl.addEventListener('dragover', handleDragOverSidebar);
        DOMElements.lessonsListEl.addEventListener('dragleave', (e) => DOMElements.lessonsListEl.classList.remove('drag-over-sidebar'));
        DOMElements.lessonsListEl.addEventListener('drop', handleDropOnSidebar);
        getEl('theme-toggle').addEventListener('change', (e) => {
            DOMElements.body.classList.toggle('dark-theme', e.target.checked);
            DOMElements.body.classList.toggle('light-theme', !e.target.checked);
            localStorage.setItem('theme', e.target.checked ? 'dark' : 'light');
        });
        getEl('bw-print-toggle').addEventListener('change', (e) => {
            state.settings.bwPrint = e.target.checked;
            DOMElements.body.classList.toggle('bw-print', state.settings.bwPrint);
            saveState();
        });
        getEl('integrated-view-toggle').addEventListener('change', (e) => {
            state.settings.integratedView = e.target.checked;
            DOMElements.appContainer.classList.toggle('integrated-view', state.settings.integratedView);
            saveState();
        });
        DOMElements.teacherSelector.addEventListener('change', (e) => {
            if (state.activeView === 'teacher') {
                renderTeacherSchedule(e.target.value);
            }
        });
        DOMElements.zoomSlider.addEventListener('input', (e) => {
            document.documentElement.style.setProperty('--table-zoom', e.target.value);
        });
        getEl('constraint-type-select').addEventListener('change', renderConstraintItemSelect);
        getEl('constraint-item-select').addEventListener('change', renderConstraintsSchedule);
        getEl('toggle-validation-panel').addEventListener('click', () => DOMElements.validationPanel.classList.toggle('open'));
        ['lesson-form', 'teacher-form', 'class-form', 'room-form'].forEach(formId => {
            const form = getEl(formId);
            if (form) form.addEventListener('submit', handleFormSubmit);
        });
        getEl('highlight-type-select').addEventListener('change', populateHighlightItemSelect);
        getEl('highlight-item-select').addEventListener('change', addHighlight);
        getEl('clear-highlights-btn').addEventListener('click', clearAllHighlights);
    }

    const handleGlobalClick = async (e) => {
        const target = e.target;

        if (target.closest('#add-lesson-btn')) {
            e.stopPropagation();
            openModal('lesson', 'add');
            return;
        }

        if (target.classList.contains('modal') || target.closest('.close-btn')) {
            const modal = target.closest('.modal');
            if(modal) modal.style.display = 'none';
            return;
        }

        const tableCell = target.closest('.drop-zone, #constraints-schedule td:not(.period-label)');
        if (tableCell) {
            if (state.isMergeMode && tableCell.classList.contains('drop-zone')) {
                handleMergeCellClick(tableCell);
            } else if (tableCell.closest('#constraints-schedule')) {
                handleConstraintToggle(tableCell);
            }
            return;
        }
        
        const collapsibleHeader = target.closest('.section-header.collapsible');
        if (collapsibleHeader) {
            collapsibleHeader.parentElement.classList.toggle('collapsed');
            return;
        }

        const lessonCell = target.closest('.lesson-in-table');
        if (lessonCell && !state.draggedElementInfo) {
            if (await showConfirm('حذف درس', 'آیا این درس از این جایگاه حذف شود؟')) {
                const lessonId = lessonCell.dataset.lessonId;
                const dropZone = lessonCell.closest('.drop-zone');
                const { classId, key } = dropZone.dataset;
                removeLessonFromSchedule(classId, lessonId, key);
                logChange(`درس "${cleanName(state.lessons.find(l=>l.id===lessonId)?.name)}" از جدول حذف شد.`);
                saveState();
                renderAll();
            }
            return;
        }

        if (target.id === 'toast-backup-btn') {
            handleBackup();
            target.closest('.toast')?.remove();
            return;
        }

        const button = target.closest('button');
        if (!button) return;

        const { id, classList, dataset } = button;

        if (classList.contains('remove-highlight-btn')) {
            removeHighlight(dataset.type, dataset.id);
        }
        else if (id === 'full-view-btn' || id === 'teacher-view-btn') switchView(id.includes('full') ? 'full' : 'teacher');
        else if (id === 'print-btn') handlePrint();
        else if (id === 'export-excel-btn') exportToExcel();
        else if (id === 'export-img-btn' || id === 'export-pdf-btn') exportSchedule(id.includes('pdf') ? 'pdf' : 'img');
        else if (id === 'settings-btn' || id === 'go-to-settings-btn') openModal('settings');
        else if (id === 'highlight-tool-btn') openHighlightModal();
        else if (classList.contains('week-btn')) switchWeek(dataset.week);
        else if (id === 'backup-btn') handleBackup();
        else if (id === 'restore-btn') getEl('restore-input').click();
        else if (id === 'copy-to-week-b-btn') {
            if (await showConfirm('کپی هفته الف به ب', 'این عمل تمام برنامه هفته "ب" را با برنامه هفته "الف" جایگزین می‌کند. آیا مطمئنید؟')) {
                state.schedule.B = JSON.parse(JSON.stringify(state.schedule.A));
                state.merges.B = JSON.parse(JSON.stringify(state.merges.A));
                logChange('برنامه هفته الف به هفته ب کپی شد.');
                saveState();
                showToast('برنامه هفته الف با موفقیت به هفته ب کپی شد.', 'success');
                if (state.activeWeek === 'B') renderAll();
            }
        }
        else if (id === 'clear-schedule-btn') {
            if (await showConfirm('پاک کردن جدول', `آیا از پاک کردن تمام دروس از جدول هفته "${state.activeWeek === 'A' ? 'الف' : 'ب'}" اطمینان دارید؟`)) {
                Object.keys(state.schedule[state.activeWeek]).forEach(classId => {
                    state.schedule[state.activeWeek][classId] = {};
                });
                state.merges[state.activeWeek] = [];
                logChange(`جدول هفته "${state.activeWeek === 'A' ? 'الف' : 'ب'}" پاک شد.`);
                saveState();
                renderAll();
                showToast(`جدول هفته "${state.activeWeek === 'A' ? 'الف' : 'ب'}" پاک شد.`, 'success');
            }
        } else if (id === 'reset-app-btn') {
            if (await showConfirm('حذف تمام داده‌ها', 'آیا از حذف کامل تمام اطلاعات برنامه اطمینان دارید؟ این عمل غیرقابل بازگشت است.')) {
                localStorage.clear();
                initializeApp();
                showToast('برنامه با موفقیت ریست شد.', 'success');
            }
        } else if (id === 'auto-schedule-btn') autoSchedule();
        else if (id === 'merge-tool-btn') {
            if (state.isMergeMode) {
                await finalizeMerge();
            }
            toggleMergeMode();
        }
        else if (id === 'print-all-teachers-btn') handlePrintAllTeachers();
        else if (id.startsWith('add-') && id.endsWith('-btn')) {
            const type = id.split('-')[1];
            openModal(type, 'add');
        } else if (classList.contains('edit-btn') || classList.contains('delete-btn')) {
            const itemElement = button.closest('.list-item');
            if (!itemElement) return;
            const { type, id: itemId } = itemElement.dataset;
            if (classList.contains('edit-btn')) openModal(type, 'edit', itemId);
            else if (await showConfirm(`حذف ${getPersianTypeName(type)}`, `آیا از حذف این مورد اطمینان دارید؟ تمام دروس مرتبط نیز حذف خواهند شد.`)) handleDelete(type, itemId);
        } else if (classList.contains('tab-btn')) {
            const tabId = dataset.tab;
            // Switch active tab button
            button.parentElement.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
            button.classList.add('active');
            // Switch active tab content
            const modalContent = button.closest('.modal-content');
            modalContent.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));
            const activeTabContent = getEl(`${tabId}-tab`);
            if (activeTabContent) {
                activeTabContent.classList.add('active');
            }

            // Re-render content for specific tabs to ensure it's up-to-date
            if (tabId === 'data-management') {
                renderManagementLists();
            } else if (tabId === 'constraints') {
                renderConstraintItemSelect(); // This will also call renderConstraintsSchedule
            } else if (tabId === 'change-log') {
                renderChangeLog();
            }
        }
    };

    // --- 8. Drag & Drop Handlers ---
    const handleDragStart = (e) => {
        const target = e.target.closest('.draggable, .lesson-in-table');
        if (!target) { e.preventDefault(); return; }
    
        const isFromSidebar = target.classList.contains('draggable');
        const lessonId = target.dataset.id || target.dataset.lessonId;
    
        state.draggedElementInfo = { lessonId, source: isFromSidebar ? 'sidebar' : 'schedule' };
    
        if (!isFromSidebar) {
            const dropZone = target.closest('.drop-zone');
            state.draggedElementInfo.originClassId = dropZone.dataset.classId;
            state.draggedElementInfo.originKey = dropZone.dataset.key;
        }
    
        e.dataTransfer.setData('text/plain', lessonId);
        e.dataTransfer.effectAllowed = 'move';
        setTimeout(() => target.classList.add('dragging'), 0);
    };
    
    const handleDragEnd = (e) => {
        document.querySelectorAll('.dragging').forEach(el => el.classList.remove('dragging'));
        state.draggedElementInfo = null;
        document.querySelectorAll('.drag-over, .invalid-drop').forEach(el => el.classList.remove('drag-over', 'invalid-drop'));
    };
    
    const handleDragOver = (e) => {
        e.preventDefault();
        const dropZone = e.target.closest('.drop-zone');
        if (!dropZone || state.activeView !== 'full' || state.isMergeMode) return;
    
        const lessonId = state.draggedElementInfo?.lessonId;
        if (!lessonId) return;
        const lesson = state.lessons.find(l => l.id === lessonId);
        if (!lesson) return;
    
        const { classId } = dropZone.dataset;
        
        if (lesson.classId !== classId) {
            dropZone.classList.add('invalid-drop');
            return;
        }

        const colspan = parseInt(dropZone.getAttribute('colspan') || '1');

        if(lesson.periods > colspan) {
             dropZone.classList.add('invalid-drop');
             return;
        }
        
        const { day } = dropZone.dataset;
        const startPeriod = parseInt(dropZone.dataset.period);
        let canPlace = true;
        for (let i = 0; i < lesson.periods; i++) {
            const period = startPeriod + i;
            const key = `${day}_${period}`;
            const slotContent = state.schedule[state.activeWeek]?.[classId]?.[key] || [];
            
            if (isSlotLocked({ classId, day, period, lessonId }) || slotContent.length >= 2) {
                canPlace = false;
                break;
            }
        }
    
        if (canPlace) {
            dropZone.classList.add('drag-over');
        } else {
            dropZone.classList.add('invalid-drop');
        }
    };
    
    const handleDragLeave = (e) => {
        const dropZone = e.target.closest('.drop-zone');
        if(dropZone) {
            dropZone.classList.remove('drag-over', 'invalid-drop');
        }
    };
    
    const handleDrop = async (e) => {
        e.preventDefault();
        const dropZone = e.target.closest('.drop-zone');
        document.querySelectorAll('.drag-over, .invalid-drop').forEach(el => el.classList.remove('drag-over', 'invalid-drop'));
    
        if (!state.draggedElementInfo || !dropZone || state.activeView !== 'full' || state.isMergeMode) return;
    
        const lessonId = e.dataTransfer.getData('text/plain');
        const lesson = state.lessons.find(l => l.id === lessonId);
        if (!lesson) return;
    
        const { day, classId } = dropZone.dataset;
        const startPeriod = parseInt(dropZone.dataset.period);
        
        if (lesson.classId !== classId) {
            showToast('درس فقط می‌تواند در کلاس مربوط به خودش قرار گیرد.', 'error');
            return;
        }

        const colspan = parseInt(dropZone.getAttribute('colspan') || '1');
        if(lesson.periods > colspan) {
             showToast(`این درس به ${toPersianNumber(lesson.periods)} زنگ نیاز دارد، اما این فضا فقط ${toPersianNumber(colspan)} زنگ است.`, 'error');
             return;
        }

        for (let i = 0; i < lesson.periods; i++) {
            const period = startPeriod + i;
            const key = `${day}_${period}`;
            const slotContent = state.schedule[state.activeWeek]?.[classId]?.[key] || [];
            if (slotContent.length >= 2 || isSlotLocked({ classId, day, period, lessonId })) {
                showToast('این جایگاه پر است یا قفل شده.', 'error');
                return;
            }
        }
    
        const conflictDetails = checkForConflict(lesson, day, startPeriod, classId);
        if (conflictDetails) {
            let message = `تداخل دبیر با کلاس: ${conflictDetails.teacher.map(cleanName).join(', ')}.`;
            if (!(await showConfirm('تداخل در برنامه', `${message} آیا می‌خواهید ادامه دهید؟`))) return;
        }
    
        if (state.draggedElementInfo.source === 'schedule') {
            removeLessonFromSchedule(state.draggedElementInfo.originClassId, lessonId, state.draggedElementInfo.originKey);
        }
    
        placeLessonInSchedule(classId, day, startPeriod, lesson);
        
        const className = state.classes.find(c => c.id === classId)?.name || '';
        logChange(`درس "${cleanName(lesson.name)}" در کلاس "${cleanName(className)}" روز ${day} زنگ ${toPersianNumber(startPeriod)} قرار گرفت.`);
    
        saveState();
        renderAll();
    };

    const handleDragOverSidebar = (e) => {
        e.preventDefault();
        if (state.draggedElementInfo && state.draggedElementInfo.source === 'schedule') {
            e.dataTransfer.dropEffect = 'move';
            DOMElements.lessonsListEl.classList.add('drag-over-sidebar');
        }
    };

    const handleDropOnSidebar = (e) => {
        e.preventDefault();
        DOMElements.lessonsListEl.classList.remove('drag-over-sidebar');
        if (state.draggedElementInfo && state.draggedElementInfo.source === 'schedule') {
            const { lessonId, originClassId, originKey } = state.draggedElementInfo;
            removeLessonFromSchedule(originClassId, lessonId, originKey);
            logChange(`درس "${cleanName(state.lessons.find(l=>l.id===lessonId)?.name)}" به لیست تخصیص نیافته بازگردانده شد.`);
            saveState();
            renderAll();
        }
    };

    // --- 9. Data Management & Modals ---
    const placeLessonInSchedule = (classId, day, startPeriod, lesson) => {
        const schedule = state.schedule[state.activeWeek];
        if (!schedule[classId]) schedule[classId] = {};
    
        for (let i = 0; i < lesson.periods; i++) {
            const period = startPeriod + i;
            const key = `${day}_${period}`;
            if (!schedule[classId][key]) {
                schedule[classId][key] = [];
            }
            schedule[classId][key].push({
                lessonId: lesson.id,
                isStart: i === 0
            });
        }
    };
    
    const removeLessonFromSchedule = (classId, lessonIdToRemove, startKey) => {
        const schedule = state.schedule[state.activeWeek][classId];
        const lesson = state.lessons.find(l => l.id === lessonIdToRemove);
        if (!schedule || !lesson || !startKey) {
             console.error("Remove failed: missing data", {classId, lessonIdToRemove, startKey});
             return;
        }
    
        const [day, periodStr] = startKey.split('_');
        const startPeriod = parseInt(periodStr);
    
        for (let i = 0; i < lesson.periods; i++) {
            const key = `${day}_${startPeriod + i}`;
            if (schedule[key]) {
                schedule[key] = schedule[key].filter(entry => entry.lessonId !== lessonIdToRemove);
                if (schedule[key].length === 0) {
                    delete schedule[key];
                }
            }
        }
    };

    const handleDelete = (type, id) => {
        const item = state[type === 'class' ? 'classes' : `${type}s`]?.find(i => i.id === id);
        const itemName = item ? cleanName(item.name) : 'مورد حذف شده';
        
        const arrayName = type === 'class' ? 'classes' : `${type}s`;
        state[arrayName] = state[arrayName].filter(item => item.id !== id);

        if (type === 'teacher' || type === 'class') {
            const lessonsToRemove = state.lessons.filter(l => (type === 'teacher' && l.teacherId === id) || (type === 'class' && l.classId === id)).map(l => l.id);
            state.lessons = state.lessons.filter(l => !lessonsToRemove.includes(l.id));

            ['A', 'B'].forEach(week => {
                Object.keys(state.schedule[week]).forEach(classId => {
                    Object.keys(state.schedule[week][classId]).forEach(key => {
                        state.schedule[week][classId][key] = state.schedule[week][classId][key]
                            .filter(entry => !lessonsToRemove.includes(entry.lessonId));
                        if (state.schedule[week][classId][key].length === 0) {
                            delete state.schedule[week][classId][key];
                        }
                    });
                });
            });
        }

        if (type === 'class') {
            delete state.schedule.A[id];
            delete state.schedule.B[id];
        }
        
        logChange(`${getPersianTypeName(type)} "${itemName}" و تمام دروس مرتبط حذف شد.`);
        saveState();
        if (getEl('settings-modal').style.display === 'flex') renderManagementLists();
        renderAll();
        showToast(`${getPersianTypeName(type)} با موفقیت حذف شد.`, 'success');
    };

    const openModal = (type, mode = 'add', id = null) => {
        const modal = getEl(`${type}-modal`);
        if (!modal) return;
    
        if (type === 'settings') {
            renderManagementLists();
            renderConstraintItemSelect();
            renderChangeLog();
            modal.style.display = 'flex';
            return;
        }
    
        const form = modal.querySelector('form');
        if (form) {
            form.reset();
            form.dataset.mode = mode;
            form.dataset.id = id || '';
        }
    
        modal.querySelector('h2').textContent = `${mode === 'edit' ? 'ویرایش' : 'افزودن'} ${getPersianTypeName(type)}`;
    
        if (type === 'lesson') {
            const teacherSelect = getEl('lesson-teacher-select');
            teacherSelect.innerHTML = '<option value="">-- انتخاب دبیر --</option>';
            state.teachers.sort((a,b) => a.name.localeCompare(b.name)).forEach(t => teacherSelect.innerHTML += `<option value="${t.id}">${t.name}</option>`);
    
            const classSelect = getEl('lesson-class-select');
            classSelect.innerHTML = '<option value="">-- انتخاب کلاس --</option>';
            state.classes.sort((a,b) => a.name.localeCompare(b.name)).forEach(c => classSelect.innerHTML += `<option value="${c.id}">${cleanName(c.name)}</option>`);
            
            const roomSelect = getEl('lesson-room-select');
            roomSelect.innerHTML = '<option value="">-- بدون اتاق خاص --</option>';
            state.rooms.sort((a,b) => a.name.localeCompare(b.name)).forEach(r => roomSelect.innerHTML += `<option value="${r.id}">${r.name}</option>`);
        }
    
        if (mode === 'edit' && id) {
            const arrayName = type === 'class' ? 'classes' : `${type}s`;
            const item = state[arrayName]?.find(i => i.id === id);
            if (!item) { showToast("مورد برای ویرایش یافت نشد", "error"); return; }
            form.querySelector(`[id$="-name-input"]`).value = item.name;
            if (type === 'lesson') {
                getEl('lesson-teacher-select').value = item.teacherId || "";
                getEl('lesson-class-select').value = item.classId || "";
                getEl('lesson-room-select').value = item.roomId || "";
                getEl('lesson-periods-input').value = item.periods || 1;
            }
            if (type === 'class') {
                getEl('class-field-input').value = item.field || "";
            }
        }
    
        modal.style.display = 'flex';
    };
    
    const handleFormSubmit = (e) => {
        e.preventDefault();
        const form = e.target;
        const type = form.id.split('-')[0];
        const { mode, id } = form.dataset;
        const name = form.querySelector(`[id$="-name-input"]`).value.trim();
        if (!name && type !== 'room') {
             showToast("نام نمی‌تواند خالی باشد.", "error"); return; 
        }
    
        const dataArrayName = type === 'class' ? 'classes' : `${type}s`;
    
        if (mode === 'add') {
            const newItem = { id: `${type[0]}${Date.now()}${Math.random()}`, name };
            if (type === 'lesson') {
                newItem.teacherId = getEl('lesson-teacher-select').value;
                newItem.classId = getEl('lesson-class-select').value;
                newItem.roomId = getEl('lesson-room-select').value || null;
                newItem.periods = parseInt(getEl('lesson-periods-input').value) || 1;
                if (!newItem.teacherId || !newItem.classId) { showToast('لطفا کلاس و دبیر را انتخاب کنید.', 'error'); return; }
            }
            if (type === 'class') {
                newItem.field = getEl('class-field-input').value.trim() || 'عمومی';
                if (!state.schedule.A[newItem.id]) state.schedule.A[newItem.id] = {};
                if (!state.schedule.B[newItem.id]) state.schedule.B[newItem.id] = {};
            }
            state[dataArrayName].push(newItem);
            logChange(`${getPersianTypeName(type)} جدید "${name}" اضافه شد.`);
        } else {
            const item = state[dataArrayName].find(i => i.id === id);
            if (item) {
                item.name = name;
                if (type === 'lesson') {
                    item.teacherId = getEl('lesson-teacher-select').value;
                    item.classId = getEl('lesson-class-select').value;
                    item.roomId = getEl('lesson-room-select').value || null;
                    item.periods = parseInt(getEl('lesson-periods-input').value) || 1;
                }
                if (type === 'class') {
                    item.field = getEl('class-field-input').value.trim() || 'عمومی';
                }
                logChange(`${getPersianTypeName(type)} "${name}" ویرایش شد.`);
            }
        }
    
        saveState();
        assignAllColors();
        if (getEl('settings-modal').style.display === 'flex') renderManagementLists();
        renderAll();
        form.closest('.modal').style.display = 'none';
        showToast(`${getPersianTypeName(type)} با موفقیت ذخیره شد.`, 'success');
    };

    // --- 10. Advanced Features & Handlers ---
    const handleBackup = () => {
        const fileName = `پشتیبان-برنامه-${new Date().toLocaleDateString('fa-IR').replace(/\//g, '-')}.json`;
        const link = document.createElement('a');
        link.href = URL.createObjectURL(new Blob([JSON.stringify(state)], { type: 'application/json' }));
        link.download = fileName;
        link.click();
        URL.revokeObjectURL(link.href);
        showToast('فایل پشتیبان با موفقیت ایجاد شد.', 'success');
        logChange('پشتیبان‌گیری از اطلاعات انجام شد.');
        saveState();
    };
    
    const startBackupReminder = () => {
        if (backupInterval) clearInterval(backupInterval);
        backupInterval = setInterval(() => {
            const backupBtnHTML = ` <button id="toast-backup-btn" class="toast-btn">پشتیبان‌گیری</button>`;
            showToast('فراموش نکنید از اطلاعات خود پشتیبان تهیه کنید!', 'warning', 10000, backupBtnHTML);
        }, 10 * 60 * 1000);
    };

    const exportToExcel = () => {
        showLoading(true);
        try {
            const days = ['شنبه', 'یکشنبه', 'دوشنبه', 'سه‌شنبه', 'چهارشنبه', 'پنج‌شنبه'];
            const periods = 4;
            const sortedClasses = state.classes.sort((a, b) => a.name.localeCompare(b.name));
            
            const data = [];
            const headerRow = ['کلاس'];
            days.forEach(day => {
                for (let p = 1; p <= periods; p++) {
                    headerRow.push(`${day} - زنگ ${toPersianNumber(p)}`);
                }
            });
            data.push(headerRow);
    
            sortedClasses.forEach(c => {
                const row = [cleanName(c.name)];
                days.forEach(day => {
                    for (let p = 1; p <= periods; p++) {
                        const key = `${day}_${p}`;
                        const slotContent = state.schedule[state.activeWeek]?.[c.id]?.[key];
                        
                        if (slotContent && slotContent.length > 0) {
                            const cellText = slotContent.map(entry => {
                                const lesson = state.lessons.find(l => l.id === entry.lessonId);
                                const teacher = state.teachers.find(t => t.id === lesson?.teacherId);
                                if (!lesson) return '';
                                return entry.isStart ? `${cleanName(lesson.name)} (${teacher?.name || 'بی‌نام'})` : '';
                            }).filter(Boolean).join(' | ');
                            row.push(cellText);
                        } else {
                            row.push('');
                        }
                    }
                });
                data.push(row);
            });
    
            const worksheet = XLSX.utils.aoa_to_sheet(data);
            const workbook = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(workbook, worksheet, "برنامه هفتگی");
    
            const colWidths = headerRow.map((_, i) => ({ wch: i === 0 ? 20 : 30 }));
            worksheet['!cols'] = colWidths;
    
            XLSX.writeFile(workbook, `برنامه-هفتگی-${state.activeWeek}.xlsx`);
            showToast('خروجی اکسل با موفقیت ایجاد شد.', 'success');
        } catch (err) {
            console.error('Excel export error:', err);
            showToast('خطا در ایجاد خروجی اکسل.', 'error');
        } finally {
            showLoading(false);
        }
    };

    const exportSchedule = async (type) => {
        const elementToExport = getEl(state.activeView === 'full' ? 'full-school-view' : 'teacher-view').querySelector('#schedule-to-export');
        if (!elementToExport) {
            showToast('جدولی برای خروجی گرفتن وجود ندارد.', 'error');
            return;
        }
        showLoading(true);
        
        DOMElements.appContainer.classList.add('preparing-export');
        await new Promise(resolve => setTimeout(resolve, 100));
    
        try {
            const canvas = await html2canvas(elementToExport, {
                scale: 2.5,
                useCORS: true,
                backgroundColor: DOMElements.body.classList.contains('dark-theme') ? '#1e272e' : '#ffffff',
            });
    
            if (type === 'img') {
                const link = document.createElement('a');
                link.download = `برنامه-هفتگی.png`;
                link.href = canvas.toDataURL('image/png');
                link.click();
            } else {
                const { jsPDF } = window.jspdf;
                const imgData = canvas.toDataURL('image/jpeg', 0.9);
                const pdf = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
                const pdfWidth = pdf.internal.pageSize.getWidth();
                const pdfHeight = pdf.internal.pageSize.getHeight();
                const ratio = canvas.width / canvas.height;
                let imgWidth = pdfWidth - 10;
                let imgHeight = imgWidth / ratio;
                if (imgHeight > pdfHeight - 10) {
                    imgHeight = pdfHeight - 10;
                    imgWidth = imgHeight * ratio;
                }
                const x = (pdfWidth - imgWidth) / 2;
                const y = (pdfHeight - imgHeight) / 2;
                pdf.addImage(imgData, 'JPEG', x, y, imgWidth, imgHeight);
                pdf.save(`برنامه-هفتگی.pdf`);
            }
            showToast(`خروجی ${type === 'pdf' ? 'PDF' : 'عکس'} با موفقیت ایجاد شد.`, 'success');
        } catch (err) {
            console.error('Export error:', err);
            showToast('خطا در ایجاد خروجی.', 'error');
        } finally {
            DOMElements.appContainer.classList.remove('preparing-export');
            showLoading(false);
        }
    };
    
    const handlePrint = () => {
        DOMElements.body.classList.add('printing');
        setTimeout(() => {
            window.print();
            DOMElements.body.classList.remove('printing');
        }, 100);
    };

    const handlePrintAllTeachers = async () => {
        const printContainer = getEl('print-all-container');
        if (!printContainer) return;

        showLoading(true);
        getEl('settings-modal').style.display = 'none';
        await new Promise(r => setTimeout(r, 50));

        let content = '';
        const originalView = state.activeView;
        const originalTeacher = DOMElements.teacherSelector.value;
        
        DOMElements.fullSchoolViewEl.classList.remove('active');
        DOMElements.teacherViewEl.classList.add('active');

        for (const teacher of state.teachers) {
            renderTeacherSchedule(teacher.id);
            await new Promise(r => setTimeout(r, 20));
            const scheduleHTML = DOMElements.teacherViewEl.innerHTML;
            content += scheduleHTML;
        }

        printContainer.innerHTML = content;
        DOMElements.body.classList.add('printing');
        printContainer.classList.remove('hidden');
        DOMElements.appContainer.classList.add('hidden');
        
        showLoading(false);

        setTimeout(() => {
            window.print();
            DOMElements.body.classList.remove('printing');
            printContainer.classList.add('hidden');
            printContainer.innerHTML = '';
            DOMElements.appContainer.classList.remove('hidden');
            switchView(originalView);
            if(originalView === 'teacher') {
                DOMElements.teacherSelector.value = originalTeacher;
                renderTeacherSchedule(originalTeacher);
            }
        }, 200);
    };


    const handleRestore = async (e) => { 
        const file = e.target.files[0];
        if (!file) return;
        if (await showConfirm('بازیابی اطلاعات', 'هشدار: تمام اطلاعات فعلی شما با محتویات این فایل جایگزین خواهد شد. آیا ادامه می‌دهید؟')) {
            const reader = new FileReader();
            reader.onload = (event) => {
                try {
                    const restoredState = JSON.parse(event.target.result);
                    if (restoredState.teachers && restoredState.lessons && restoredState.classes && restoredState.schedule) {
                        const tempState = {};
                        setDefaultState.call({ state: tempState });
                        
                        state = {
                            ...tempState,
                            ...restoredState,
                            settings: { ...tempState.settings, ...(restoredState.settings || {}) }
                        };

                        logChange(`اطلاعات از فایل "${file.name}" بازیابی شد.`);
                        saveState();
                        initializeApp();
                        showToast('اطلاعات با موفقیت بازیابی شد.', 'success');
                    } else {
                        showToast('فایل پشتیبان معتبر نیست.', 'error');
                    }
                } catch (error) {
                    console.error("Restore error:", error);
                    showToast('خطا در خواندن فایل پشتیبان.', 'error');
                }
            };
            reader.readAsText(file);
        }
        e.target.value = '';
     };

    const switchView = (viewName) => {
        state.activeView = viewName;
        const isFull = viewName === 'full';
        DOMElements.fullSchoolViewEl.classList.toggle('active', isFull);
        DOMElements.teacherViewEl.classList.toggle('active', !isFull);
        DOMElements.teacherSelectorContainer.classList.toggle('hidden', isFull);
        getEl('full-view-btn').classList.toggle('active', isFull);
        getEl('teacher-view-btn').classList.toggle('active', !isFull);
        DOMElements.mergeToolBtn.classList.toggle('hidden', !isFull);
        if (state.isMergeMode) {
            toggleMergeMode();
        }
        refreshCurrentView();
    };

    const switchWeek = (week) => {
        state.activeWeek = week;
        getEl('week-a-btn').classList.toggle('active', week === 'A');
        getEl('week-b-btn').classList.toggle('active', week === 'B');
        DOMElements.copyToWeekBBtn.classList.toggle('hidden', week !== 'B');
        if (state.isMergeMode) {
            toggleMergeMode();
        }
        renderAll();
    };

    const refreshCurrentView = () => {
        if (state.activeView === 'full') {
            renderFullSchedule();
        } else {
            renderTeacherSchedule(DOMElements.teacherSelector.value);
        }
    };

    // --- 11. Conflict, Constraints & Validation ---
    const isSlotLocked = ({ classId, day, period, lessonId }) => {
        const lesson = lessonId ? state.lessons.find(l => l.id === lessonId) : null;
        const teacherId = lesson?.teacherId;
        const periodNum = parseInt(period);
    
        return state.constraints.unavailable.some(c =>
            (c.type === 'class' && c.id === classId && c.day === day && c.period === periodNum) ||
            (c.type === 'teacher' && c.id === teacherId && c.day === day && c.period === periodNum)
        );
    };
    
    const checkForConflict = (lesson, day, startPeriod, currentClassId) => {
        if (!lesson) return null;
        const conflicts = { teacher: [], room: [] };
    
        for (let i = 0; i < lesson.periods; i++) {
            const period = startPeriod + i;
            const key = `${day}_${period}`;
    
            for (const classId in state.schedule[state.activeWeek]) {
                if (classId === currentClassId) continue;
                const slot = state.schedule[state.activeWeek][classId]?.[key] || [];
                slot.forEach(entry => {
                    const existingLesson = state.lessons.find(l => l.id === entry.lessonId);
                    if (existingLesson) {
                        if (lesson.teacherId && lesson.teacherId === existingLesson.teacherId) {
                            conflicts.teacher.push(state.classes.find(c => c.id === classId)?.name || 'کلاس حذف شده');
                        }
                        if (lesson.roomId && lesson.roomId === existingLesson.roomId) {
                            conflicts.room.push(state.classes.find(c => c.id === classId)?.name || 'کلاس حذف شده');
                        }
                    }
                });
            }
        }
    
        const teacherConflict = [...new Set(conflicts.teacher)];
        const roomConflict = [...new Set(conflicts.room)];
        
        if (teacherConflict.length > 0 || roomConflict.length > 0) {
            return { teacher: teacherConflict, room: roomConflict };
        }
        return null;
    };

    const runValidation = () => {
        const totalLessons = state.lessons.length;
        const totalHours = state.lessons.reduce((sum, l) => sum + l.periods, 0) * 2;
        const scheduledLessonIds = new Set(
            Object.values(state.schedule[state.activeWeek]).flatMap(Object.values).flatMap(slot => slot.map(l => l.lessonId))
        );
        const placedLessonsCount = scheduledLessonIds.size;
        let placedHours = 0;
        scheduledLessonIds.forEach(id => {
            const lesson = state.lessons.find(l => l.id === id);
            if (lesson) placedHours += (lesson.periods * 2);
        });

        const statsHTML = `
            <div class="stat-item"><span>کل دروس:</span> <span>${toPersianNumber(totalLessons)}</span></div>
            <div class="stat-item"><span>دروس جایابی شده:</span> <span>${toPersianNumber(placedLessonsCount)}</span></div>
            <div class="stat-item"><span>دروس باقی‌مانده:</span> <span>${toPersianNumber(totalLessons - placedLessonsCount)}</span></div>
            <hr>
            <div class="stat-item"><span>کل ساعت‌ها:</span> <span>${toPersianNumber(totalHours)}</span></div>
            <div class="stat-item"><span>ساعت‌های جایابی شده:</span> <span>${toPersianNumber(placedHours)}</span></div>
            <div class="stat-item"><span>ساعت‌های باقی‌مانده:</span> <span>${toPersianNumber(totalHours - placedHours)}</span></div>
        `;
        DOMElements.statsContainer.innerHTML = `<h4><i class="fas fa-chart-pie"></i> آمار کلی</h4>${statsHTML}`;

        const conflicts = { teacher: [], room: [] };
        const timeSlots = {};
        const days = ['شنبه', 'یکشنبه', 'دوشنبه', 'سه‌شنبه', 'چهارشنبه', 'پنج‌شنبه'];
        const periods = 4;

        for (const day of days) {
            for (let period = 1; period <= periods; period++) {
                const key = `${day}_${period}`;
                timeSlots[key] = [];
                for (const classId in state.schedule[state.activeWeek]) {
                    const slot = state.schedule[state.activeWeek][classId]?.[key] || [];
                    slot.forEach(entry => {
                        const lesson = state.lessons.find(l => l.id === entry.lessonId);
                        if (lesson) {
                            timeSlots[key].push({ teacherId: lesson.teacherId, classId, roomId: lesson.roomId });
                        }
                    });
                }
            }
        }

        for (const key in timeSlots) {
            const teacherCounts = {};
            const roomCounts = {};
            timeSlots[key].forEach(slot => {
                teacherCounts[slot.teacherId] = (teacherCounts[slot.teacherId] || 0) + 1;
                if (slot.roomId) {
                    roomCounts[slot.roomId] = (roomCounts[slot.roomId] || 0) + 1;
                }
            });
            const [day, period] = key.split('_');
            for (const teacherId in teacherCounts) {
                if (teacherCounts[teacherId] > 1) {
                    const teacher = state.teachers.find(t => t.id === teacherId);
                    const classesInvolved = timeSlots[key].filter(s => s.teacherId === teacherId).map(s => cleanName(state.classes.find(c => c.id === s.classId)?.name || 'نامشخص'));
                    conflicts.teacher.push(`تداخل دبیر <strong>${teacher?.name || '؟'}</strong> روز ${day} زنگ ${toPersianNumber(period)} در کلاس‌های: ${[...new Set(classesInvolved)].join(', ')}`);
                }
            }
            for (const roomId in roomCounts) {
                if (roomCounts[roomId] > 1) {
                    const room = state.rooms.find(r => r.id === roomId);
                    const classesInvolved = timeSlots[key].filter(s => s.roomId === roomId).map(s => cleanName(state.classes.find(c => c.id === s.classId)?.name || 'نامشخص'));
                    conflicts.room.push(`تداخل اتاق <strong>${room?.name || '؟'}</strong> روز ${day} زنگ ${toPersianNumber(period)} در کلاس‌های: ${[...new Set(classesInvolved)].join(', ')}`);
                }
            }
        }
        
        let conflictsHTML = '<h4><i class="fas fa-exclamation-triangle"></i> تداخل‌ها</h4>';
        const allConflicts = [...new Set(conflicts.teacher), ...new Set(conflicts.room)];
        if (allConflicts.length === 0) {
            conflictsHTML += '<p class="no-conflict-text">هیچ تداخلی یافت نشد.</p>';
        } else {
            conflictsHTML += allConflicts.map(c => `<div class="conflict-item">${c}</div>`).join('');
        }
        DOMElements.conflictsContainer.innerHTML = conflictsHTML;
    };

    // --- 12. Cell Merging & Highlighting Logic ---
    const toggleMergeMode = () => {
        state.isMergeMode = !state.isMergeMode;
        DOMElements.mergeToolBtn.classList.toggle('active', state.isMergeMode);
        DOMElements.fullSchoolViewEl.classList.toggle('merge-mode', state.isMergeMode);
        state.mergeSelection = [];
        document.querySelectorAll('.merge-select').forEach(c => c.classList.remove('merge-select'));
        if(state.isMergeMode) {
            showToast('حالت ادغام فعال شد. روی زنگ‌های متوالی کلیک کنید.', 'info');
        }
    };

    const handleMergeCellClick = (cell) => {
        if (cell.classList.contains('locked-slot') || cell.querySelector('.lesson-in-table')) {
            showToast('نمی‌توان زنگ‌های پر یا قفل شده را ادغام کرد.', 'warning');
            return;
        }

        const { classId, day, period } = cell.dataset;
        const periodNum = parseInt(period);

        const existingMerge = state.merges[state.activeWeek].find(m => m.classId === classId && m.day === day && periodNum >= m.startPeriod && periodNum < m.startPeriod + m.count);
        if (existingMerge) {
            state.mergeSelection = [{ mergeToRemove: existingMerge }];
            const startCell = document.querySelector(`.drop-zone[data-class-id="${classId}"][data-day="${day}"][data-period="${existingMerge.startPeriod}"]`);
            if (startCell) startCell.classList.add('merge-select');
            showToast('این بخش ادغام شده است. برای جداسازی، روی دکمه ادغام کلیک کنید.', 'info');
            return;
        }

        if (state.mergeSelection.length > 0) {
            const firstCell = state.mergeSelection[0];
            if (firstCell.classId !== classId || firstCell.day !== day) {
                state.mergeSelection = [];
                document.querySelectorAll('.merge-select').forEach(c => c.classList.remove('merge-select'));
            }
        }

        const cellInfo = { classId, day, period: periodNum, element: cell };
        
        const selectedIndex = state.mergeSelection.findIndex(s => s.period === periodNum);
        if (selectedIndex > -1) {
            state.mergeSelection.splice(selectedIndex, 1);
            cell.classList.remove('merge-select');
        } else {
            state.mergeSelection.push(cellInfo);
            cell.classList.add('merge-select');
        }
    };
    
    const finalizeMerge = async () => {
        if (state.mergeSelection.length === 0) return;

        if (state.mergeSelection.length === 1 && state.mergeSelection[0].mergeToRemove) {
            const merge = state.mergeSelection[0].mergeToRemove;
            if (await showConfirm('جداسازی زنگ‌ها', 'آیا این بخش از حالت ادغام خارج شود؟')) {
                 const index = state.merges[state.activeWeek].indexOf(merge);
                 if (index > -1) {
                     state.merges[state.activeWeek].splice(index, 1);
                     logChange(`ادغام در کلاس "${cleanName(state.classes.find(c=>c.id===merge.classId)?.name)}" روز ${merge.day} لغو شد.`);
                     saveState();
                     refreshCurrentView();
                 }
            }
        } 
        else if (state.mergeSelection.length > 1) {
            state.mergeSelection.sort((a, b) => a.period - b.period);
            const periods = state.mergeSelection.map(s => s.period);
            const isConsecutive = periods.every((p, i) => i === 0 || p === periods[i-1] + 1);

            if (!isConsecutive) {
                showToast('فقط زنگ‌های متوالی را می‌توان ادغام کرد.', 'error');
                return;
            }

            const first = state.mergeSelection[0];
            const count = state.mergeSelection.length;
            if (await showConfirm('ادغام زنگ‌ها', `آیا ${toPersianNumber(count)} زنگ انتخاب شده با هم ادغام شوند؟`)) {
                state.merges[state.activeWeek].push({
                    classId: first.classId,
                    day: first.day,
                    startPeriod: first.period,
                    count: count
                });
                logChange(`${toPersianNumber(count)} زنگ در کلاس "${cleanName(state.classes.find(c=>c.id===first.classId)?.name)}" روز ${first.day} ادغام شد.`);
                saveState();
                refreshCurrentView();
            }
        }
    };

    const openHighlightModal = () => {
        populateHighlightItemSelect();
        renderActiveHighlights();
        getEl('highlight-modal').style.display = 'flex';
    };

    const populateHighlightItemSelect = () => {
        const type = getEl('highlight-type-select').value;
        const select = getEl('highlight-item-select');
        const arrayName = type === 'class' ? 'classes' : `${type}s`;
        const items = state[arrayName];
        select.innerHTML = `<option value="">-- انتخاب کنید --</option>`;
        items.sort((a, b) => a.name.localeCompare(b.name)).forEach(item => {
            select.innerHTML += `<option value="${item.id}">${item.name}</option>`;
        });
        select.value = "";
    };

    const addHighlight = () => {
        const type = getEl('highlight-type-select').value;
        const id = getEl('highlight-item-select').value;
        if (!id) return;

        const alreadyExists = state.activeHighlights.some(h => h.type === type && h.id === id);
        if (!alreadyExists) {
            state.activeHighlights.push({ type, id });
            saveState();
            refreshCurrentView();
            renderActiveHighlights();
        }
        getEl('highlight-item-select').value = '';
    };

    const removeHighlight = (type, id) => {
        state.activeHighlights = state.activeHighlights.filter(h => !(h.type === type && h.id === id));
        saveState();
        refreshCurrentView();
        renderActiveHighlights();
    };

    const clearAllHighlights = () => {
        state.activeHighlights = [];
        saveState();
        refreshCurrentView();
        renderActiveHighlights();
    };

    const renderActiveHighlights = () => {
        const container = getEl('active-highlights-container');
        if (!container) return;
        container.innerHTML = '';
        if (state.activeHighlights.length === 0) {
            container.innerHTML = '<p class="empty-list-text">موردی برای هایلایت انتخاب نشده است.</p>';
            return;
        }

        state.activeHighlights.forEach(h => {
            const { type, id } = h;
            const arrayName = type === 'class' ? 'classes' : `${type}s`;
            const item = state[arrayName].find(i => i.id === id);
            if (item) {
                const tag = document.createElement('div');
                tag.className = 'highlight-tag';
                tag.innerHTML = `
                    <span>${getPersianTypeName(type)}: ${item.name}</span>
                    <button class="remove-highlight-btn" data-type="${type}" data-id="${id}" title="حذف این هایلایت">&times;</button>
                `;
                container.appendChild(tag);
            }
        });
    };
    
    const autoSchedule = async () => {
        showLoading(true);
        await new Promise(resolve => setTimeout(resolve, 50));

        const scheduledLessonIds = new Set(
            Object.values(state.schedule[state.activeWeek]).flatMap(Object.values).flatMap(slot => slot.map(l => l.lessonId))
        );
        const unplacedLessons = state.lessons.filter(lesson => !scheduledLessonIds.has(lesson.id));
        let placedCount = 0;
        const days = ['شنبه', 'یکشنبه', 'دوشنبه', 'سه‌شنبه', 'چهارشنبه', 'پنج‌شنبه'];
        const periods = 4;

        for (const lesson of unplacedLessons) {
            let isPlaced = false;
            for (const day of days) {
                for (let period = 1; period <= periods; period++) {
                    const colspan = state.merges[state.activeWeek]?.find(m => m.classId === lesson.classId && m.day === day && m.startPeriod === period)?.count || 1;
                    if (lesson.periods > colspan) continue;

                    let canPlace = true;
                    for (let i = 0; i < lesson.periods; i++) {
                        const currentPeriod = period + i;
                        const key = `${day}_${currentPeriod}`;
                        const slotContent = state.schedule[state.activeWeek]?.[lesson.classId]?.[key] || [];
                        if (isSlotLocked({ classId: lesson.classId, day, period: currentPeriod, lessonId: lesson.id }) || checkForConflict(lesson, day, period, lesson.classId) || slotContent.length > 0) {
                            canPlace = false;
                            break;
                        }
                    }

                    if (canPlace) {
                        placeLessonInSchedule(lesson.classId, day, period, lesson);
                        placedCount++;
                        isPlaced = true;
                        break;
                    }
                }
                if (isPlaced) break;
            }
        }

        showLoading(false);
        if (placedCount > 0) {
            logChange(`${toPersianNumber(placedCount)} درس به صورت خودکار چیده شد.`);
            saveState();
            renderAll();
            showToast(`${toPersianNumber(placedCount)} درس با موفقیت در برنامه قرار گرفت.`, 'success');
        } else {
            showToast('هیچ جای خالی مناسبی برای دروس باقی‌مانده یافت نشد.', 'warning');
        }
    };

    // --- 13. Final Setup & Initialization ---
    const assignAllColors = () => {
        if (state.lessons) {
            state.lessons.forEach(lesson => {
                if (!state.lessonColors[lesson.id]) {
                    state.lessonColors[lesson.id] = generateColorFromString(lesson.name + lesson.teacherId);
                }
            });
        }
        if (state.classes) {
            state.classes.forEach(c => {
                if (c.field && !state.fieldColors[c.field]) {
                    state.fieldColors[c.field] = generateColorFromString(c.field);
                }
            });
        }
    };

    const renderManagementLists = () => {
        const configs = {
            'teachers-management': { data: state.teachers, type: 'teacher', icon: 'fa-chalkboard-teacher', title: 'دبیران' },
            'classes-management': { data: state.classes, type: 'class', icon: 'fa-school', title: 'کلاس‌ها' },
            'rooms-management': { data: state.rooms, type: 'room', icon: 'fa-door-open', title: 'اتاق‌ها' }
        };

        for (const [id, config] of Object.entries(configs)) {
            const container = getEl(id);
            if (!container) continue;
            const sortedData = config.data.sort((a, b) => a.name.localeCompare(b.name));
            container.innerHTML = `<h3><i class="fas ${config.icon}"></i> ${config.title}</h3><div class="item-list" id="${config.type}-list-management"></div><button class="panel-btn" id="add-${config.type}-btn"><i class="fas fa-plus"></i> افزودن</button>`;
            renderList(getEl(`${config.type}-list-management`), sortedData, config.type);
        }
    };
    
    const renderChangeLog = () => {
        const listEl = getEl('change-log-list');
        if (!listEl) return;
        listEl.innerHTML = '';
        if (state.changeLog.length === 0) {
            listEl.innerHTML = '<p class="empty-list-text">هنوز تغییری ثبت نشده است.</p>';
            return;
        }
        state.changeLog.forEach(log => {
            const item = document.createElement('div');
            item.className = 'list-item';
            const logTime = new Date(log.time).toLocaleString('fa-IR', { dateStyle: 'short', timeStyle: 'short' });
            item.innerHTML = `
                <div class="log-desc">${log.description}</div>
                <div class="log-time">${logTime}</div>
            `;
            listEl.appendChild(item);
        });
    };

    const renderConstraintItemSelect = () => {
        const type = getEl('constraint-type-select').value;
        const select = getEl('constraint-item-select');
        if (!select) return;
        const arrayName = type === 'class' ? 'classes' : `${type}s`;
        const items = state[arrayName];
        select.innerHTML = '';
        items.sort((a, b) => a.name.localeCompare(b.name)).forEach(item => select.innerHTML += `<option value="${item.id}">${item.name}</option>`);
        renderConstraintsSchedule();
    };

    const renderConstraintsSchedule = () => {
        const container = getEl('constraints-schedule');
        if (!container) return;
        const type = getEl('constraint-type-select').value;
        const selectedId = getEl('constraint-item-select').value;
        const days = ['شنبه', 'یکشنبه', 'دوشنبه', 'سه‌شنبه', 'چهارشنبه', 'پنج‌شنبه'];
        const periods = 4;
        let tableHTML = `<table id="constraints-table"><thead><tr><th></th>${days.map(day => `<th>${day.slice(0,3)}</th>`).join('')}</tr></thead><tbody>`;
        for (let i = 1; i <= periods; i++) {
            tableHTML += `<tr><td class="period-label">زنگ ${toPersianNumber(i)}</td>`;
            days.forEach(day => {
                const isLocked = state.constraints.unavailable.some(c =>
                    c.type === type && c.id === selectedId && c.day === day && c.period === i
                );
                tableHTML += `<td data-day="${day}" data-period="${i}" class="${isLocked ? 'locked-slot' : ''}"></td>`;
            });
            tableHTML += '</tr>';
        }
        tableHTML += '</tbody></table>';
        container.innerHTML = tableHTML;
    };

    const handleConstraintToggle = (cell) => {
        const { day, period } = cell.dataset;
        const type = getEl('constraint-type-select').value;
        const id = getEl('constraint-item-select').value;
        if (!id) {
            showToast('لطفاً یک مورد را از لیست انتخاب کنید.', 'warning');
            return;
        }

        const periodNum = parseInt(period);
        const index = state.constraints.unavailable.findIndex(c => c.type === type && c.id === id && c.day === day && c.period === periodNum);

        if (index > -1) {
            state.constraints.unavailable.splice(index, 1);
            cell.classList.remove('locked-slot');
        } else {
            state.constraints.unavailable.push({ type, id, day, period: periodNum });
            cell.classList.add('locked-slot');
        }
        saveState();
        refreshCurrentView();
    };

    initializeApp();
});
