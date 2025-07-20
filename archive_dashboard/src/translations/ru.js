// Russian translations
export const TRANSLATIONS_RU = {
    // Page title and main headers
    title: "Панель управления архивом",
    subtitle: "Извлечение и загрузка изображений и аудио из архива ВК с метаданными EXIF",
    
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
        processButton: "Загрузить выбранные медиафайлы",
        calculating: "Вычисление...",
        noSelection: "Контент не выбран"
    },
    
    // Configuration options
    config: {
        exifMetadata: "Добавить EXIF метаданные (даты из ВК)",
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
        title: "Загрузка медиафайлов",
        status: "Статус",
        downloadReady: "Загрузка готова",
        initializing: "Инициализация...",
        failedDownloads: "Неудачные загрузки"
    },
    
    // Status messages
    status: {
        buildingList: "Формирование списка файлов...",
        queuedImages: "Добавлено в очередь {count} изображений из {type} '{name}'.",
        foundTotal: "Найдено {count} изображений для загрузки.",
        noImages: "Изображения не выбраны или не найдены.",
        downloadComplete: "Загрузка завершена. Успешно загружено {success} из {total} изображений.",
        creatingZip: "Создание ZIP-архива с метаданными, пожалуйста, подождите...",
        zipReady: "Ваш ZIP-файл с метаданными готов к загрузке.",
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
        invalidArchive: "Неверный архив VK. Следующие необходимые файлы не найдены:",
        fileNotFound: "Не удалось найти файл: {file}",
        parseError: "Не удалось проанализировать дату VK: '{date}' - {error}",
        downloadError: "Не удалось скачать с {url}: {error}",
        zipError: "Произошла ошибка при создании ZIP-файла: {error}",
        exifError: "Не удалось добавить данные EXIF к {name}: {error}"
    },
    
    // Analysis messages
    analysis: {
        loading: "Загрузка архива, пожалуйста, подождите...",
        validating: "Проверка структуры архива...",
        analyzing: "Анализ содержимого архива...",
        estimatingImages: "Оценка количества изображений...",
        error: "Ошибка анализа",
        found: "Обнаружено {albums} альбомов и {chats} чатов.",
        foundWithCounts: "Обнаружено {albums} альбомов с {albumImages} изображениями и {chats} чатов с {chatImages} медиафайлами, всего {totalImages} медиафайлов."
    },
    
    // Validation messages
    validation: {
        missingFile: "Отсутствует необходимый файл: {file}",
        invalidArchive: "Неверный архив ВК"
    },
    
    // Buttons and controls
    buttons: {
        returnToStart: "Вернуться к началу",
        downloadZip: "Загрузить ваш ZIP-файл",
        downloadSummary: "Загрузить страницу сводки (со всеми ZIP-ссылками)",
        processing: "Обработка...",
        selectFile: "Выбрать файл",
        stopDownload: "Остановить загрузку"
    },
    
    // Theme and language
    ui: {
        language: "Язык",
        theme: "Тема",
        lightTheme: "Светлая",
        darkTheme: "Тёмная"
    },
    
    // Time units

    // Instructions
    instructions: {
        privacy: "Все приватно и работает только на вашем компьютере. Никакие данные не отправляются ни на какой сервер.",
        sourceCode: "Посмотреть исходный код на GitHub"
    },

    // Footer
    footer: {
        privacy: "Вся обработка происходит локально в вашем браузере. Никакие данные никогда не отправляются на сервер."
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