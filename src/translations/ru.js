// Russian translations
const TRANSLATIONS_RU = {
    // Page title and main headers
    title: "Загрузчик фотоархивов ВКонтакте",
    subtitle: "Извлечение и загрузка фотографий из архива ВК с метаданными EXIF",
    
    // Upload screen
    upload: {
        title: "Выберите архив ВК",
        dropText: "Перетащите ZIP-файл сюда или нажмите для выбора",
        analyzing: "Анализ ZIP-файла, пожалуйста подождите...",
        dragOver: "Отпустите для загрузки файла",
        invalidFile: "Пожалуйста, выберите действительный ZIP-файл."
    },
    
    // Selection screen
    selection: {
        title: "Выберите контент для загрузки",
        albums: "Альбомы",
        chats: "Чаты",
        albumsCount: "альбомов найдено",
        chatsCount: "чатов найдено",
        search: "Поиск...",
        selectAll: "Выбрать все",
        deselectAll: "Снять выбор",
        configuration: "Настройки",
        estimatedTime: "Примерно {count} изображений за {time}",
        processButton: "Загрузить выбранные изображения",
        calculating: "Вычисление...",
        noSelection: "Контент не выбран"
    },
    
    // Configuration options
    config: {
        exifMetadata: "Добавить метаданные EXIF из дат ВК",
        batchSize: "Размер пакета загрузки",
        sleepTime: "Задержка между пакетами (мс)",
        sortOrder: "Сортировать изображения по",
        sortOptions: {
            name: "Названию",
            date: "Дате",
            size: "Размеру"
        },
        archiveBatching: "Создавать несколько ZIP-файлов для больших загрузок",
        archiveBatchSize: "Изображений в ZIP-файле",
        batchSizeHelp: "Количество изображений для одновременной загрузки. Меньшие значения снижают использование памяти.",
        sleepTimeHelp: "Задержка между пакетами загрузки для избежания ограничения скорости."
    },
    
    // Progress screen
    progress: {
        title: "Загрузка изображений",
        status: "Статус",
        downloadReady: "Загрузка готова",
        initializing: "Инициализация..."
    },
    
    // Status messages
    status: {
        buildingList: "Формирование списка файлов...",
        queuedImages: "В очередь добавлено {count} изображений из {type} \"{name}\".",
        foundTotal: "Найдено всего {count} изображений для загрузки.",
        noImages: "Не выбрано или не найдено изображений. Нечего делать.",
        downloadComplete: "Загрузка завершена. Успешно получено {success} из {total} изображений.",
        creatingZip: "Создание ZIP-архива с метаданными...",
        zipReady: "ZIP-файл с метаданными готов для загрузки!",
        exifSummary: "Сводка обработки EXIF:",
        imagesWithDates: "Изображений с разобранными датами ВК: {count}/{total}",
        imagesWithExif: "Изображений с добавленными данными EXIF: {count}/{total} (только JPEG)",
        fileTimestampNote: "Примечание: Временные метки файлов нельзя установить из-за ограничений браузера.",
        checkMetadata: "Проверьте download_metadata.json для подробной информации об обработке.",
        batchComplete: "ПАКЕТНАЯ ОБРАБОТКА ЗАВЕРШЕНА",
        totalDownloaded: "Всего изображений загружено: {count}",
        totalFailed: "Всего изображений не удалось загрузить: {count}",
        zipFilesCreated: "Количество созданных ZIP-файлов: {count}",
        cleaningMemory: "Очистка памяти перед следующим пакетом...",
        summaryCreated: "Создана страница сводки загрузки со ссылками на все ZIP-файлы.",
        downloadSummaryFirst: "ВАЖНО: Сначала загрузите страницу сводки, затем используйте её для загрузки всех ZIP-файлов."
    },
    
    // Error messages
    errors: {
        invalidArchive: "Неверный архив ВК. Не найдены необходимые файлы:",
        fileNotFound: "Файл не найден: {file}",
        parseError: "Не удалось разобрать дату ВК: \"{date}\" - {error}",
        downloadError: "Не удалось загрузить {url}: {error}",
        zipError: "Ошибка создания ZIP-файла: {error}",
        exifError: "Не удалось добавить данные EXIF к {name}: {error}"
    },
    
    // Analysis messages
    analysis: {
        loading: "Загрузка архива...",
        validating: "Проверка структуры архива...",
        analyzing: "Анализ содержимого...",
        estimatingImages: "Оценка количества изображений...",
        error: "Ошибка анализа",
        found: "Найдено {albums} альбомов и {chats} чатов",
        foundWithCounts: "Найдено {albums} альбомов ({albumImages} изображений) и {chats} чатов ({chatImages} изображений) - Всего: {totalImages} изображений"
    },
    
    // Validation messages
    validation: {
        missingFile: "Отсутствует требуемый файл: {file}",
        invalidArchive: "Неверный архив ВК"
    },
    
    // Buttons and controls
    buttons: {
        returnToStart: "Вернуться к началу",
        downloadZip: "Загрузить ваш ZIP-файл",
        downloadSummary: "Загрузить страницу сводки (со всеми ZIP-ссылками)",
        processing: "Обработка...",
        selectFile: "Выбрать файл"
    },
    
    // Theme and language
    ui: {
        language: "Язык",
        theme: "Тема",
        lightTheme: "Светлая",
        darkTheme: "Тёмная"
    },
    
    // Time units
    time: {
        minutes: "{count} минут",
        seconds: "с",
        lessThanMinute: "Меньше 1 минуты",
        hoursMinutes: "{hours}ч {minutes}м",
        calculating: "Вычисление...",
        noContent: "Контент не выбран"
    },
    
    // File types
    fileTypes: {
        album: "альбома",
        chat: "чата"
    },
    
    // Batch summary page
    batchSummary: {
        title: "Сводка загрузки архива ВК",
        processingComplete: "Обработка завершена",
        totalImagesDownloaded: "Всего изображений загружено:",
        totalImagesFailed: "Всего изображений не удалось загрузить:",
        numberOfZipFiles: "Количество ZIP-файлов:",
        processingDate: "Дата обработки:",
        downloadZipFiles: "Загрузить ваши ZIP-файлы",
        downloadNote: "Примечание: Загрузите все файлы перед закрытием этой страницы. Ссылки истекут при переходе на другую страницу."
    }
};

// Export for use in other files
if (typeof module !== 'undefined' && module.exports) {
    module.exports = TRANSLATIONS_RU;
}