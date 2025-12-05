# NutriScan AI — Backend Technical Specification

Этот документ описывает требования к бэкенду приложения NutriScan AI. Бэкенд служит прослойкой между клиентским приложением и Google Gemini API, обеспечивая безопасность ключей API, валидацию данных и унифицированный формат ошибок.

## 1. Общие сведения

*   **API Base URL**: `/api/v1`
*   **Authentication**: Bearer Token (опционально для MVP), либо session cookie.
*   **AI Provider**: Google Gemini API (Model: `gemini-2.5-flash`).
*   **Формат обмена**: JSON.

### Обработка ошибок
Все ошибки должны возвращаться в формате:
```json
{
  "error": {
    "code": "BAD_REQUEST",
    "message": "Invalid image format",
    "details": null
  }
}
```

---

## 2. Gemini Integration & Prompt Engineering (Для Бэкенд-разработчика)

Для обеспечения консистентности данных фронтенд ожидает, что модель всегда возвращает JSON строго определенной структуры. При интеграции с Gemini используйте следующие настройки.

### 2.1. Конфигурация Модели
*   **Model**: `gemini-2.5-flash` (оптимально по скорости/цене для зрения и текста).
*   **Temperature**: `0.2 - 0.4` (для более детерминированных расчетов БЖУ).
*   **Response Format**: `application/json` (обязательно используйте `responseSchema` или `responseMimeType`).

### 2.2. System Instruction
Этот системный промпт должен добавляться ко всем запросам анализа:

> "Ты профессиональный диетолог и эксперт по питанию. Твоя задача: Анализировать еду, определять продукты, оценивать их вес и считать КБЖУ (Калории, Белки, Жиры, Углеводы). Всегда отвечай в формате JSON. Язык ответов — Русский."

### 2.3. Целевая JSON Схема (Target Schema)
Фронтенд ожидает следующий объект. Эту схему нужно передавать в параметр `responseSchema` SDK.

```typescript
// Описание интерфейса на TypeScript
interface AnalysisResponse {
  items: Array<{
    name: string;          // Название продукта (например, "Куриная грудка")
    weightGrams: number;   // Вес в граммах
    macros: {
      calories: number;
      protein: number;
      fat: number;
      carbs: number;
    };
    confidence: number;    // От 0.0 до 1.0
  }>;
  total: {
    calories: number;
    protein: number;
    fat: number;
    carbs: number;
  };
  summary: string;         // Краткое резюме (макс 10 слов)
}
```

---

## 3. Endpoints Specification

### 3.1. Analyze Image (Анализ по фото)
Принимает изображение, отправляет его в Gemini Vision, возвращает расчет КБЖУ.

*   **POST** `/analyze/image`
*   **Content-Type**: `application/json`

**Request Body:**
```json
{
  "image": "base64_encoded_string_without_header", 
  "mimeType": "image/jpeg" 
}
```
*Примечание: Фронтенд может отправлять base64 без префикса `data:image/...`.*

**Backend Implementation Guide:**
1.  Сформировать запрос к Gemini:
    *   `parts`: `[{ inlineData: { mimeType: ..., data: ... } }, { text: "Проанализируй это блюдо. Определи ингредиенты, их примерный вес и КБЖУ." }]`
2.  Использовать `responseSchema` из раздела 2.3.
3.  Вернуть результат.

**Response (200 OK):**
```json
{
  "items": [
    {
      "name": "Картофельное пюре",
      "weightGrams": 200,
      "macros": { "calories": 180, "protein": 4, "fat": 6, "carbs": 30 },
      "confidence": 0.9
    }
  ],
  "total": { "calories": 180, "protein": 4, "fat": 6, "carbs": 30 },
  "summary": "Классический гарнир.",
  "modelUsed": "gemini-2.5-flash"
}
```

---

### 3.2. Analyze Text (Анализ текста)
Принимает текстовое описание (например, "Съел яблоко и бутерброд"), возвращает расчет.

*   **POST** `/analyze/text`
*   **Content-Type**: `application/json`

**Request Body:**
```json
{
  "text": "Два жареных яйца и кусок черного хлеба"
}
```

**Backend Implementation Guide:**
1.  Prompt: `"Проанализируй этот прием пищи: \"{text}\". Рассчитай КБЖУ."`
2.  Использовать ту же `responseSchema`.

---

### 3.3. Recalculate (Корректировка)
Пользователь может сказать "Там было не 200г картошки, а 300г" или "Убеди хлеб". Бэкенд должен отправить предыдущий контекст и новую правку в LLM.

*   **POST** `/recalculate`
*   **Content-Type**: `application/json`

**Request Body:**
```json
{
  "currentAnalysis": { ... полный объект предыдущего ответа ... },
  "correction": "Хлеба не было, добавь стакан кефира"
}
```

**Backend Implementation Guide:**
1.  Сформировать Prompt:
    ```text
    Текущий анализ: {JSON.stringify(currentAnalysis)}
    Исправление пользователя: "{correction}"
    
    Задача:
    1. Обнови состав продуктов и вес на основе исправления.
    2. Пересчитай КБЖУ для измененных позиций.
    3. Верни полностью обновленный JSON.
    ```
2.  Отправить в модель с той же `responseSchema`.

---

### 3.4. Transcribe Audio (Распознавание речи)
Принимает аудиофайл (blob), возвращает текст. Это вспомогательный эндпоинт, чтобы фронтенд мог заполнить поле ввода голосом.

*   **POST** `/transcribe`
*   **Content-Type**: `multipart/form-data`

**Request:**
*   File field: `file` (audio/webm, audio/mp3, etc.)

**Response (200 OK):**
```json
{
  "text": "Я съел большую тарелку борща со сметаной"
}
```

**Backend Implementation Guide:**
1.  Использовать Gemini Flash.
2.  Input: Audio content part.
3.  Prompt: `"Transcribe exactly what is said in this audio. Return only the text."`
4.  Здесь **НЕ** нужен JSON Schema, достаточно plain text ответа.

---

## 4. Требования к валидации
1.  **Image Size**: Лимит 5MB (Фронтенд сжимает до 1024px, но бэкенд должен страховать).
2.  **Audio Size**: Лимит 2MB (Голосовые заметки обычно короткие).
3.  **Rate Limiting**: Ограничить 10-20 запросов в минуту на IP, чтобы не сжечь квоты Gemini API.

