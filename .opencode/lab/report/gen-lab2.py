#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Generate the AIIP Lab-2 (Part 2: Алгоритм) report as a valid ODT.

Reuses the Lab-1 pipeline (gen.py): template styles, paragraph/table/figure/TOC
helpers and the ODT packaging, and appends Lab-2 specific styles (H3, code).
Title-page and ЗМІСТ follow the Lab-1 conventions; figure captions go below the
frame, table captions above the table.
"""
import json
import os
import re
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import gen  # noqa: E402  (reused pipeline)

REPO = os.path.abspath(os.path.join(HERE, "..", "..", ".."))
OUT_ODT = os.environ.get(
    "LAB_OUT_ODT",
    "/home/wired/Documents/poly/AIIP-LAB2_Volchenko_PZIP-11_звіт.odt",
)
PAGES_JSON = os.environ.get("LAB2_PAGES", os.path.join(HERE, "pages-lab2.json"))

P = gen.P
PX = gen.PX
st = gen.st
table = gen.table
figure = gen.figure
pagebreak = gen.pagebreak

# --------------------------------------------------------------- extra styles
st('<style:style style:name="H3" style:family="paragraph" style:parent-style-name="Heading">'
   '<style:paragraph-properties fo:text-align="left" fo:line-height="125%" fo:margin-top="0.3cm" '
   'fo:margin-bottom="0.12cm" fo:keep-with-next="always" style:justify-single-word="false"/>'
   '<style:text-properties style:font-name="Times New Roman" fo:font-size="12pt" fo:font-weight="bold" '
   'style:font-size-asian="12pt" style:font-size-complex="12pt" style:font-weight-asian="bold" '
   'style:font-weight-complex="bold"/></style:style>')

st('<style:style style:name="TableCaption" style:family="paragraph" style:parent-style-name="Standard">'
   '<style:paragraph-properties fo:text-align="center" fo:line-height="120%" fo:margin-top="0.25cm" '
   'fo:margin-bottom="0.1cm" fo:keep-with-next="always" style:justify-single-word="false"/>'
   '<style:text-properties style:font-name="Times New Roman" fo:font-size="11pt" '
   'style:font-size-asian="11pt" style:font-size-complex="11pt"/></style:style>')

st('<style:style style:name="TableCaptionBreak" style:family="paragraph" style:parent-style-name="TableCaption">'
   '<style:paragraph-properties fo:break-before="page"/></style:style>')

st('<style:style style:name="Code" style:family="paragraph" style:parent-style-name="Standard">'
   '<style:paragraph-properties fo:text-align="left" fo:line-height="100%" fo:margin-left="0.25cm" '
   'fo:margin-bottom="0cm" fo:hyphenate="false" style:justify-single-word="false"/>'
   '<style:text-properties style:font-name="Liberation Mono" fo:font-family="Liberation Mono" fo:font-size="7pt" '
   'style:font-size-asian="7pt" style:font-size-complex="7pt"/></style:style>')

st('<style:style style:name="CodeLabel" style:family="paragraph" style:parent-style-name="Standard">'
   '<style:paragraph-properties fo:text-align="left" fo:line-height="125%" fo:margin-top="0.35cm" '
   'fo:margin-bottom="0.1cm" fo:keep-with-next="always" style:justify-single-word="false"/>'
   '<style:text-properties style:font-name="Times New Roman" fo:font-size="11pt" fo:font-weight="bold" '
   'style:font-size-asian="11pt" style:font-size-complex="11pt" style:font-weight-asian="bold" '
   'style:font-weight-complex="bold"/></style:style>')

# --------------------------------------------------------------- TOC definition
TOC_ITEMS = [
    (1, "1. Тема"),
    (1, "2. Постановка завдання"),
    (1, "3. Мета роботи"),
    (1, "4. Опис алгоритму"),
    (1, "5. Основні функції реалізації"),
    (2, "5.1. Склад модулів застосунку"),
    (2, "5.2. Ключові функції та їхній інтерфейс"),
    (2, "5.3. Повний вихідний код"),
    (1, "6. Обґрунтування вибору алгоритму"),
    (1, "7. Вибір технологій"),
    (1, "8. Недоліки та обмеження реалізації"),
    (1, "9. Аналіз можливості паралельного виконання"),
    (1, "10. Паралельність залежно від технології"),
    (1, "11. Практичний приклад паралельного виконання"),
    (1, "12. Висновок"),
]

SOURCE_FILES = [
    ("src/index.html", "text/html"),
    ("src/css/style.css", "text/css"),
    ("src/js/util.js", "js"),
    ("src/js/rng.js", "js"),
    ("src/js/logger.js", "js"),
    ("src/js/generator.js", "js"),
    ("src/js/model.js", "js"),
    ("src/js/train-worker.js", "js"),
    ("src/js/charts.js", "js"),
    ("src/js/ecg-render.js", "js"),
    ("src/js/image-export.js", "js"),
    ("src/js/data-step.js", "js"),
    ("src/js/train-step.js", "js"),
    ("src/js/recognize-step.js", "js"),
    ("src/js/app.js", "js"),
]


def uk_lines(n):
    """Ukrainian plural for the word "рядок" (line)."""
    if n % 10 == 1 and n % 100 != 11:
        return "%d рядок" % n
    if n % 10 in (2, 3, 4) and n % 100 not in (12, 13, 14):
        return "%d рядки" % n
    return "%d рядків" % n


def read_source(rel):
    with open(os.path.join(REPO, rel), encoding="utf-8") as f:
        return f.read()


def code_line_xml(line):
    # Tabs become four spaces; runs of spaces become NBSP so that LibreOffice
    # keeps them in the monospace font (text:s inherits the serif metrics and
    # renders indentation too narrow).
    s = line.replace("\t", "    ")
    s = gen.esc(s)
    s = re.sub(r" {2,}", lambda m: "\u00a0" * len(m.group(0)), s)
    return s


def code_block(rel, label=None, note=None):
    text = read_source(rel)
    lines = text.split("\n")
    if lines and lines[-1] == "":
        lines = lines[:-1]
    out = []
    head = label or ("%s (%d)" % (rel, len(lines)))
    out.append(P("CodeLabel", head))
    if note:
        out.append(P("BodyFirst", note))
    for ln in lines:
        out.append(PX("Code", code_line_xml(ln)))
    return "".join(out)


def code_raw(text, label):
    """Code fragment supplied inline (already plain text, no escaping)."""
    out = [P("CodeLabel", label)]
    for ln in text.split("\n"):
        out.append(PX("Code", code_line_xml(ln)))
    return "".join(out)


# --------------------------------------------------------------- tables
st('<style:style style:name="TRow" style:family="table-row">'
   '<style:table-row-properties fo:keep-together="always"/></style:style>')
st('<style:style style:name="TRowKeep" style:family="table-row">'
   '<style:table-row-properties fo:keep-together="always" fo:keep-with-next="always"/></style:style>')

_col = [0]


def table(headers, rows, widths, name="Tbl", keep=False):
    """Table with bordered cells; rows never split, small tables stay whole."""
    total = sum(widths)
    coldefs = []
    cells_head = []
    for i, w in enumerate(widths):
        cm = round(gen.TEXT_W_CM * w / total, 3)
        cs = "TCol_%s_%d" % (name, i)
        st('<style:style style:name="%s" style:family="table-column">'
           '<style:table-column-properties style:column-width="%scm"/></style:style>' % (cs, cm))
        coldefs.append('<table:table-column table:style-name="%s"/>' % cs)
        cells_head.append('<table:table-cell table:style-name="TCellHead">%s</table:table-cell>'
                          % P("TableHead", headers[i]))
    head_style = "TRow"
    header_row = ('<table:table-header-rows><table:table-row table:style-name="%s">' % head_style
                  + "".join(cells_head) + "</table:table-row></table:table-header-rows>")
    body_rows = []
    last = len(rows) - 1
    for ri, r in enumerate(rows):
        rstyle = "TRow"
        tds = "".join('<table:table-cell table:style-name="TCell">%s</table:table-cell>'
                      % P("TableCell", str(c)) for c in r)
        body_rows.append('<table:table-row table:style-name="%s">%s</table:table-row>'
                         % (rstyle, tds))
    keep_attr = ' table:may-break-between-rows="false"' if keep else ""
    return ('<table:table table:name="%s" table:style-name="TblStyle"%s>' % (name, keep_attr)
            + "".join(coldefs) + header_row + "".join(body_rows) + "</table:table>")


def tcap(n, text):
    return P("TableCaption", "Таблиця %d - %s" % (n, text))


def first(text):
    return P("BodyFirst", text)


def body(text):
    return P("Body", text)


def bullets(items):
    inner = "".join('<text:list-item>%s</text:list-item>' % P("ListItem", it) for it in items)
    return '<text:list text:style-name="LBullet">%s</text:list>' % inner


def nums(items):
    inner = "".join('<text:list-item>%s</text:list-item>' % P("ListItem", it) for it in items)
    return '<text:list text:style-name="LNum">%s</text:list>' % inner


# --------------------------------------------------------------- body
def build_body(pages):
    out = []
    b = out.append

    # ------------------------------------------------ title page
    b(P("TitleLine", "Міністерство освіти і науки України"))
    b(P("TitleLine", "Національний університет «Львівська Політехніка»"))
    b(P("TitleLine", "Інститут комп’ютерних наук та інформаційних технологій"))
    b(P("TitleLine", "Кафедра програмного забезпечення"))
    for _ in range(5):
        b(P("TitleLine"))
    b(P("TitleBig", "Звіт до лабораторної роботи №2"))
    b(P("TitleLine", "З дисципліни: «Опрацювання зображень методами штучного інтелекту»"))
    b(P("TitleTopic", "на тему: «Розпізнавання серцевих ритмів за допомогою нейронної мережі. "
                     "Частина 2. Алгоритм»"))
    for _ in range(4):
        b(P("TitleLine"))
    b(P("TitleRight", "Виконав:"))
    b(P("TitleRight", "ст.гр. ПЗІП-11"))
    b(P("TitleRight", "Волченко Д.О."))
    b(P("TitleRight"))
    b(P("TitleRight", "Прийняв:"))
    b(P("TitleRight", "асистент кафедри ПЗ"))
    b(P("TitleRight", "Романяк О. І."))
    for _ in range(3):
        b(P("TitleLine"))
    b(P("TitleLine", "Львів – 2026"))
    b(pagebreak())

    # ------------------------------------------------ TOC
    b(P("TocTitle", "ЗМІСТ"))
    for level, text in TOC_ITEMS:
        pg = pages.get(text, "0")
        style = "TocEntry" if level == 1 else "TocEntry2"
        b(PX(style, gen.esc(text) + "<text:tab/>" + str(pg)))
    b(pagebreak())

    # ------------------------------------------------ 1. Тема
    b(gen.H1("1. Тема"))
    b(body("Розпізнавання серцевих ритмів (нормальний синусовий ритм, тахікардія, брадикардія) "
           "за допомогою нейронної мережі. Частина 2. Алгоритм."))
    b(body("У другій частині лабораторної роботи пороговий евристичний класифікатор, "
           "розроблений у першій частині, замінено на справжню нейронну мережу прямого поширення "
           "(feed-forward neural network) бібліотеки Brain.js. Мережа отримує на вхід вікно з K=4 "
           "значень частоти серцевих скорочень, нормованих до діапазону 0…1, і видає розподіл "
           "ймовірностей за трьома класами ритмів. Навчання виконується у фоновому потоці "
           "(Web Worker) з резервним покроковим режимом на головному потоці."))
    b(body("Публічний програмний інтерфейс класу RhythmModel залишено незмінним, тому графічний "
           "інтерфейс, збереження моделі, журнал операцій і всі три кроки робочого процесу "
           "працюють без переписування."))

    # ------------------------------------------------ 2. Постановка
    b(gen.H1("2. Постановка завдання"))
    b(body("Варіант 6. Завдання за методичними вказівками:"))
    b(P("BodyFirst", "«Згенерувати послідовності по 4 числа, що відображають: 1) ритми нормального "
                     "серця, 2) серця швидкого (тахікардія) і 3) повільного (брадикардія). Ними "
                     "навчити просту мережу і розпізнавати послідовності на вході. Кількість даних "
                     "можна обмежити.»"))
    b(body("У межах другої частини роботи необхідно:"))
    b(bullets([
        "замінити пороговий алгоритм першої частини на нейронну мережу, яка навчається на "
        "згенерованих послідовностях, зберігши незмінним публічний інтерфейс моделі "
        "(train, predictWindow, predictSeries, evaluate, toJSON, fromJSON);",
        "підтримувати три класи ритмів варіанта 6 з діапазонами, наведеними в таблиці 1;",
        "нормалізувати вхідні значення BPM у діапазон 0…1 та подавати їх на K=4 входів мережі;",
        "виконувати навчання у Web Worker, щоб інтерфейс не блокувався, і передбачити коректний "
        "резервний режим навчання на головному потоці;",
        "відображати реальний прогрес навчання (епоха, помилка, точність на train і test), "
        "підтримувати дострокову зупинку та ручну зупинку;",
        "зберігати й відновлювати навчену модель разом із вагами мережі у форматі JSON;",
        "навести в звіті повний вихідний код власних модулів застосунку;",
        "забезпечити роботу застосунку локально (file://), без серверної частини та без етапу "
        "збирання.",
    ]))
    b(body("Класи ритмів і діапазони, що використовуються у варіанті 6, наведено в таблиці 1."))
    b(tcap(1, "Класи ритмів варіанта 6"))
    b(table(
        ["Клас (key)", "Назва", "Діапазон, BPM", "Колір (Okabe–Ito)"],
        [
            ["bradycardia", "Брадикардія (повільний ритм)", "40–60", "#009e73 (зелений)"],
            ["normal", "Нормальний синусовий ритм", "60–100", "#0072b2 (синій)"],
            ["tachycardia", "Тахікардія (швидкий ритм)", "100–140", "#e69f00 (оранжевий)"],
        ],
        [19, 35, 19, 27], "T1", keep=True))

    # ------------------------------------------------ 3. Мета
    b(gen.H1("3. Мета роботи"))
    b(body("Застосувати та створити алгоритм розпізнавання серцевих ритмів за допомогою нейронної "
           "мережі: згенерувати навчальний набір послідовностей трьох класів, навчити просту "
           "багатошарову мережу прямого поширення, реалізувати нормування входу, обчислення "
           "ймовірностей і ковзне вікно для довших послідовностей, а також організувати навчання "
           "у фоновому потоці з резервним режимом."))

    # ------------------------------------------------ 4. Опис алгоритму
    b(gen.H1("4. Опис алгоритму"))
    b(body("Алгоритм розв’язує задачу класифікації: за вікном із K=4 послідовних значень частоти "
           "серцевих скорочень (BPM) визначити один із трьох класів ритму та оцінити впевненість "
           "передбачення. Формально це відображення f: R^K → {bradycardia, normal, tachycardia}, "
           "яке реалізовано навченою нейронною мережею. Нижче описано етапи алгоритму від "
           "генерації даних до інтерпретації результату."))
    b(body("Етап 1 — генерація даних. Для кожного класу генерується задана кількість послідовностей "
           "за формулою з методичних вказівок. Спочатку випадково обирається «верхній» рівень "
           "Tmax ~ U(min, max) у діапазоні класу, потім «нижній» Tmin = Tmax − U(0, tol), де tol — "
           "допуск у BPM. Кожне з K значень послідовності незалежно набуває значення Tmax або Tmin. "
           "Отже, послідовність описує серію ударів із невеликим розкидом навколо обраного рівня. "
           "Клас зберігається як ключ, а не як числовий індекс, що робить файли даних читабельними."))
    b(body("Етап 2 — нормування входу. Значення BPM переводяться у відрізок 0…1 за лінійним "
           "перетворенням x = clamp((v − min) / (max − min), 0, 1), де межі кодування "
           "обчислюються з навчальної вибірки: min = floor((minBPM − 10) / 10)·10, "
           "max = ceil((maxBPM + 10) / 10)·10. Для діапазонів варіанта 6 це дає 30 і 150. "
           "Нормування потрібне тому, що функція активації сигмоїда насичується на великих "
           "значеннях: вхід 120 BPM без нормування давав би похідні, близькі до нуля, і навчання "
           "гальмувалося б. Заодно межі кодування зберігаються в моделі, тому під час "
           "розпізнавання застосовується точно те саме перетворення."))
    b(body("Етап 3 — формування цілей. Клас кодується унітарним кодом (one-hot) у порядку "
           "CLASSES: bradycardia → [1,0,0], normal → [0,1,0], tachycardia → [0,0,1]. Такий вихід "
           "природно інтерпретується як три незалежні сигмоїди, а після softmax — як розподіл "
           "ймовірностей."))
    b(body("Етап 4 — архітектура мережі. Використано повнозв’язну мережу прямого поширення "
           "4–8–3: чотири входи (значення вікна), один прихований шар із 8 нейронів із "
           "сигмоїдною активацією та три виходи. Кількість параметрів становить "
           "(4·8 + 8) + (8·3 + 3) = 67. Мережа тренується методом зворотного поширення помилки "
           "з моментом (momentum), який згладжує коливання ваг."))
    b(body("Етап 5 — навчання. Параметри за замовчуванням: 1000 епох, швидкість навчання 0,3, "
           "момент 0,1, 8 прихованих нейронів. Одна епоха — це один виклик net.train із "
           "iterations: 1, тому після кожної епохи можна зняти помилку та оновити індикатор "
           "прогресу. Точність на train і test обчислюється не кожної епохи, а кожні "
           "evalEvery = max(1, round(epochs / 100)) епох (для 1000 епох — кожні 10), щоб "
           "вимірювання не домінувало над самим навчанням. Помилка — середньоквадратична (MSE), "
           "яку повертає Brain.js. Якщо задано поріг errorThresh > 0 і помилка стала не більшою "
           "за нього, навчання завершується достроково; окремо перевіряється прапорець зупинки "
           "користувача."))
    b(body("Етап 6 — розпізнавання вікна. Мережа повертає три виходи, які після softmax "
           "перетворюються на ймовірності p_i = exp(z_i − max z) / Σ exp(z_j − max z). "
           "Клас визначається як argmax(p), а впевненість — як максимальна ймовірність. "
           "Віднімання максимуму перед експонентою запобігає переповненню."))
    b(body("Етап 7 — обробка довших послідовностей. Для послідовності довжиною n ≥ K "
           "застосовується ковзне вікно розміру K з кроком 1: утворюється n − K + 1 вікон, для "
           "кожного обчислюється розподіл ймовірностей, після чого ймовірності усереднюються "
           "по вікнах. Підсумковий клас — argmax середніх ймовірностей. Це знижує вплив "
           "поодиноких викидів і дає змогу аналізувати ритмограми довільної довжини."))
    b(body("Етап 8 — оцінювання. На тестовій вибірці будується матриця помилок 3×3, за нею "
           "обчислюються precision, recall і F1 для кожного класу, macro-F1, точність "
           "(accuracy) та середня крос-ентропія −(1/N)·Σ ln p_true. Перелік помилкових вікон "
           "зберігається для аналізу."))
    b(body("Послідовність етапів і відповідність «вхід → перетворення → результат» наведено "
           "в таблиці 2, параметри алгоритму — у таблиці 3."))
    b(P("TableCaptionBreak", "Таблиця 2 - Етапи алгоритму розпізнавання"))
    b(table(
        ["Етап", "Вхід і перетворення", "Результат"],
        [
            ["1. Генерація", "Tmax ~ U(min,max); Tmin = Tmax − U(0,tol); K значень із {Tmax, Tmin}",
             "набір {label, bpm[K]}"],
            ["2. Нормування", "x = clamp((v − min)/(max − min), 0, 1)", "вектор у 0…1"],
            ["3. Кодування цілей", "one-hot у порядку CLASSES", "вектор [0/1] довжини 3"],
            ["4. Навчання", "backprop + momentum, одна епоха за виклик", "ваги 4–8–3, історія"],
            ["5. Розпізнавання вікна", "net.run → softmax", "probs, клас, впевненість"],
            ["6. Ковзне вікно", "n − K + 1 вікон, усереднення ймовірностей", "підсумковий клас"],
            ["7. Оцінювання", "матриця 3×3, precision/recall/F1, крос-ентропія", "метрики якості"],
        ],
        [20, 53, 27], "T2", keep=True))
    b(tcap(3, "Параметри алгоритму та значення за замовчуванням"))
    b(table(
        ["Параметр", "Позначення", "Значення", "Призначення"],
        [
            ["Довжина вікна", "K", "4", "кількість входів мережі; допустимо 3…12"],
            ["Приховані нейрони", "H", "8", "розмір єдиного прихованого шару; 1…64"],
            ["Швидкість навчання", "η", "0,3", "крок оновлення ваг"],
            ["Момент", "μ", "0,1", "інерція оновлення ваг"],
            ["Епохи", "E", "1000", "максимум проходів; допустимо 1…20000"],
            ["Поріг помилки", "errorThresh", "0 (вимкнено)", "умова дострокової зупинки"],
            ["Крок вимірювання", "evalEvery", "E/100", "частота обчислення точності"],
            ["Межі кодування", "min, max", "30, 150 BPM", "нормування входу"],
        ],
        [25, 17, 19, 39], "T3", keep=True))
    b(body("Псевдокод основних етапів алгоритму наведено нижче; імена змінних відповідають "
           "реалізації в src/js/model.js."))
    b(code_raw(
        "function TRAIN(trainSet, testSet, opts):\n"
        "    enc      <- encodingFor(all BPM values)              # [30, 150]\n"
        "    rows     <- [{ input: map(encode, sample.bpm),\n"
        "                   output: oneHot(sample.label) }]\n"
        "    layers   <- { inputSize: K, hiddenLayers: [H], outputSize: 3 }\n"
        "    evalEvery <- max(1, round(epochs / 100))\n"
        "    net      <- NeuralNetwork(layers)\n"
        "    for e in 1..epochs:\n"
        "        error <- net.train(rows, { iterations: 1, learningRate, momentum })\n"
        "        if e == 1 or e mod evalEvery == 0 or e == epochs:\n"
        "            trainAcc <- accuracy(net, trainSet)\n"
        "            testAcc  <- accuracy(net, testSet)\n"
        "        emit progress(e, error, trainAcc, testAcc)\n"
        "        if errorThresh > 0 and error <= errorThresh: break\n"
        "        if stopRequested(): break\n"
        "    return history\n"
        "\n"
        "function PREDICT_WINDOW(bpmWindow):\n"
        "    raw <- net.run(map(encode, bpmWindow))               # 3 sigmoid outputs\n"
        "    p   <- softmax(raw)\n"
        "    i   <- argmax(p)\n"
        "    return { probs: p, label: CLASSES[i], confidence: p[i] }\n"
        "\n"
        "function PREDICT_SERIES(bpm):\n"
        "    n <- length(bpm) - K + 1\n"
        "    for i in 0..n-1: p[i] <- PREDICT_WINDOW(bpm[i .. i+K-1])\n"
        "    return average(p)                                    # + per-window details\n",
        "Псевдокод навчання та розпізнавання"))
    b(body("Загальний вигляд застосунку після виконання всіх трьох кроків наведено на рисунку 1."))
    b(figure(1, 9.0, "Загальний вигляд застосунку: рядок стану, три кроки та панель журналу"))

    # ------------------------------------------------ 5. Реалізація
    b(gen.H1("5. Основні функції реалізації"))
    b(body("Розділ описано за схемою «призначення — входи — операції — результат — роль у "
           "застосунку». Спочатку наведено склад модулів і публічний інтерфейс моделі, далі — "
           "опис ключових функцій, а в підрозділі 5.3 — повний вихідний код власних файлів "
           "проєкту."))

    b(gen.H2("5.1 Склад модулів застосунку"))
    b(body("Код розділено на невеликі модулі, кожен із яких експортує один об’єкт у глобальному "
           "просторі імен window.AIIP. Такий поділ успадковано з першої частини роботи: він "
           "дозволяє підмінити рушій класифікації, не змінюючи інтерфейсні модулі. Перелік "
           "файлів, їхній розмір і призначення наведено в таблиці 4."))
    b(tcap(4, "Модулі застосунку"))
    b(table(
        ["Файл", "Рядків", "Призначення"],
        [
            ["index.html", "321", "розмітка сторінки: кроки, форми, модальні вікна, підключення скриптів"],
            ["css/style.css", "913", "оформлення, темна тема, сітка, адаптивність"],
            ["js/util.js", "136", "clamp, mean, sd, min/max, argmax, BPM↔RR, форматування, nextFrame"],
            ["js/rng.js", "63", "детермінований генератор випадкових чисел (mulberry32)"],
            ["js/logger.js", "95", "журнал операцій, збереження у файл, очищення"],
            ["js/generator.js", "231", "генерація набору за формулою, розбиття train/test, CSV/JSON"],
            ["js/model.js", "500", "нейромережева модель: навчання, прогноз, метрики, серіалізація"],
            ["js/train-worker.js", "104", "тіло Web Worker: цикл навчання та протокол повідомлень"],
            ["js/charts.js", "316", "графіки на canvas: помилка, точність, розсіювання, галерея"],
            ["js/ecg-render.js", "221", "композитне зображення результату 1400×800"],
            ["js/image-export.js", "103", "збереження PNG/JPG/BMP (власний BMP-енкодер)"],
            ["js/data-step.js", "392", "логіка кроку 1: форма, валідація, генерація, завантаження"],
            ["js/train-step.js", "402", "логіка кроку 2: параметри, навчання, метрики, криві"],
            ["js/recognize-step.js", "475", "логіка кроку 3: введення, прогноз, зображення, експорт"],
            ["js/app.js", "348", "ініціалізація, рядок стану, журнал, модальні вікна, самотест"],
        ],
        [22, 11, 67], "T4"))
    b(body("Окремо в каталозі src/lib/ лежать вендоровані файли Brain.js: brain.js (UMD-збірка "
           "2.0.0-beta.24, 547 339 байтів, ліцензія MIT) та brain-src.js (та сама збірка у вигляді "
           "рядка для вбудовування у Blob-URL воркер, 558 275 байтів). Ці файли не є власним кодом "
           "і у звіті не відтворюються."))

    b(gen.H2("5.2 Ключові функції та їхній інтерфейс"))
    b(body("Публічний інтерфейс класу RhythmModel зафіксовано ще в першій частині роботи. Його "
           "опис наведено в таблиці 5; саме цей контракт дозволив замінити пороговий алгоритм на "
           "нейронну мережу без змін у модулях інтерфейсу."))
    b(tcap(5, "Публічний програмний інтерфейс RhythmModel"))
    b(table(
        ["Метод", "Вхід", "Результат"],
        [
            ["constructor(opts)", "{k, encoding, hidden, learningRate, momentum}", "екземпляр моделі"],
            ["encode(v)", "значення BPM", "число в діапазоні 0…1"],
            ["train(trainSet, testSet, opts, hooks)", "вибірки, {epochs, errorThresh, learningRate, "
             "momentum, hidden}, хуки onEpoch/shouldStop", "Promise<history>"],
            ["predictWindow(bpm)", "масив із K значень", "{probs, index, label, confidence}"],
            ["predictSeries(bpm)", "масив ≥ K значень", "{windows, probs, index, label, confidence, perWindow}"],
            ["evaluate(samples, hooks)", "тестова вибірка, onProgress", "{confusion, perClass, accuracy, "
             "macroF1, crossEntropy, misclassified}"],
            ["toJSON()", "—", "{format, version, engine, k, hidden, …, net}"],
            ["static fromJSON(obj)", "об’єкт моделі", "новий екземпляр RhythmModel"],
            ["static encodingFor(samples)", "вибірка", "{min, max} межі кодування"],
        ],
        [30, 43, 27], "T5", keep=True))
    b(body("RhythmModel.encode(v) — призначення: нормування одного значення BPM. Вхід: число "
           "BPM. Операції: віднімання нижньої межі кодування, ділення на ширину діапазону та "
           "обмеження результату функцією clamp. Результат: число в 0…1; значення поза межами "
           "насичуються до 0 або 1. Роль: єдине місце перетворення входу, яке використовують і "
           "навчання, і прогноз, завдяки чому неможливо навчити та застосувати модель із різними "
           "масштабами."))
    b(body("RhythmModel.train(trainSet, testSet, opts, hooks) — призначення: навчити мережу та "
           "повернути історію. Вхід: навчальна й тестова вибірки у форматі {label, bpm[K]}, "
           "параметри навчання та хуки onEpoch і shouldStop. Операції: збереження параметрів, "
           "обчислення меж кодування (у конструкторі моделі), кодування вибірок у пари "
           "input/output, створення brain.NeuralNetwork із шарами {inputSize: K, hiddenLayers: [H], "
           "outputSize: 3}, запуск навчання у воркері або на головному потоці, відновлення ваг із "
           "netJSON, фіксація trainedAt. Результат: об’єкт history з масивами epoch, error, "
           "evalEpoch, trainAcc, testAcc. Роль: головна операція кроку 2, єдине місце, де "
           "змінюються ваги мережі."))
    b(body("RhythmModel.trainInWorker(data, config, evalEvery, hooks) — призначення: виконати "
           "навчання у фоновому потоці. Вхід: закодовані дані, конфігурація, крок вимірювань, "
           "хуки. Операції: перевірка доступності Worker, Blob і URL.createObjectURL; "
           "формування джерела воркера як конкатенації тексту Brain.js і функції workerMain; "
           "створення Blob-URL і воркера; надсилання повідомлення train; обробка progress, done, "
           "error; пересилання прогресу в хук onEpoch; надсилання stop за вимогою shouldStop; "
           "тайм-аут простою 120 с; terminate і revokeObjectURL після завершення. Результат: "
           "Promise, що розв’язується повідомленням done або null, якщо воркер недоступний чи "
           "впав. Роль: забезпечує відгукливість інтерфейсу; значення null є штатним сигналом "
           "перейти до резервного режиму."))
    b(body("RhythmModel.trainChunked(data, config, evalEvery, hooks) — призначення: резервне "
           "навчання на головному потоці. Вхід: ті самі дані й конфігурація. Операції: цикл по "
           "епохах із net.train({iterations: 1}); періодичне обчислення точності; запис у "
           "history; виклик onEpoch і shouldStop; перевірка errorThresh; періодичне повернення "
           "керування браузеру через await u.nextFrame(), якщо від попереднього оновлення минуло "
           "понад 16 мс. Результат: заповнена історія та навчені ваги. Роль: гарантує працездатність "
           "застосунку там, де створення воркера заблоковане (наприклад, обмеження file://), і "
           "саме цей шлях виконується в тестах Node."))
    b(body("workerMain() (src/js/train-worker.js) — призначення: тіло воркера. Вхід: повідомлення "
           "train із полями data, config, evalEvery. Операції: створення мережі, цикл епох, "
           "обчислення помилки та (за розкладом) точності, postMessage progress після кожної "
           "епохи, перевірка прапорця stop і порогу помилки, пауза setTimeout(0) для обробки "
           "черги повідомлень, postMessage done із netJSON і history. Результат: повідомлення "
           "done або error. Роль: ізолює обчислення від UI-потоку; функція серіалізується через "
           "toString(), тому не повинна посилатися на зовнішні замикання."))
    b(body("RhythmModel.predictWindow(bpm) — призначення: класифікувати одне вікно. Вхід: масив "
           "із K значень BPM. Операції: перевірка наявності мережі, net.run над нормованими "
           "значеннями, приведення виходу до масиву в порядку CLASSES, softmax, argmax. "
           "Результат: {probs, index, label, confidence}. Роль: базова операція розпізнавання."))
    b(body("RhythmModel.predictSeries(bpm) — призначення: класифікувати послідовність довільної "
           "довжини. Вхід: масив ≥ K значень. Операції: ковзне вікно з кроком 1, прогноз для "
           "кожного вікна, накопичення ймовірностей, усереднення, argmax. Результат: "
           "{windows, probs, index, label, confidence, perWindow}. Роль: використовується кроком "
           "3 і функцією оцінювання."))
    b(body("RhythmModel.evaluate(samples, hooks) — призначення: обчислити метрики якості. Вхід: "
           "тестова вибірка та хук onProgress. Операції: прогноз для кожного прикладу, заповнення "
           "матриці помилок, накопичення крос-ентропії, збір помилкових вікон, періодичне "
           "повернення керування браузеру. Результат: {confusion, perClass, accuracy, macroF1, "
           "crossEntropy, misclassified}. Роль: наповнює панель метрик і журнал."))
    b(body("toJSON() і RhythmModel.fromJSON(obj) — призначення: збереження та відновлення моделі. "
           "toJSON формує об’єкт із форматом aiip-model, версією 2, рушієм brain.js, параметрами, "
           "історією та вагами net.toJSON(). fromJSON перевіряє формат, версію, рушій, K, межі "
           "кодування й наявність мережі, після чого відновлює brain.NeuralNetwork і поля моделі, "
           "позначаючи джерело як file. Результат: JSON-об’єкт або новий екземпляр. Роль: "
           "дозволяє не повторювати навчання та переносити модель між сесіями."))
    b(body("data.generateDataset(config) і data.splitSamples(samples, testPct, rng) — призначення: "
           "синтез і розбиття даних. generateDataset приймає кількість прикладів на клас, K, "
           "допуск, зерно й діапазони, генерує послідовності за формулою та повертає "
           "{samples, meta}. splitSamples виконує стратифіковане перемішування всередині кожного "
           "класу й віддає заданий відсоток у тест, зберігаючи пропорції класів. Роль: "
           "відтворюваність експериментів завдяки зерну генератора."))
    b(body("Модальне вікно «Інформація» показує поточні параметри мережі — рушій, кількість "
           "прихованих нейронів, швидкість навчання, момент, межі кодування та точність на "
           "тестовій вибірці (рисунок 2). Довідка (рисунок 3) описує робочий процес, формулу "
           "генерації, діапазони класів і обмеження застосунку."))
    b(figure(2, 8.0, "Модальне вікно «Інформація»: рушій brain.js, параметри мережі та точність"))
    b(figure(3, 8.0, "Модальне вікно довідки з описом робочого процесу та обмежень"))

    b(gen.H2("5.3 Повний вихідний код"))
    b(body("Нижче наведено повний вихідний код власних файлів застосунку в тому вигляді, в якому "
           "він виконується. Вендорована бібліотека Brain.js (src/lib/brain.js, 534,5 КБ, MIT) і "
           "її текстова копія для воркера (src/lib/brain-src.js, 545,2 КБ) не відтворюються: це "
           "сторонній код, а його обсяг перевищує обсяг усього звіту."))

    for i, (rel, kind) in enumerate(SOURCE_FILES, start=1):
        n = len(read_source(rel).rstrip("\n").split("\n"))
        b('<text:h text:style-name="H3" text:outline-level="3">5.3.%d. %s</text:h>'
          % (i, gen.esc(rel)))
        b(P("BodyFirst", "Файл %s, %s." % (rel, uk_lines(n))))
        b(code_block(rel, label="Лістинг %d — %s" % (i, rel)))

    # ------------------------------------------------ 6. Обґрунтування
    b(gen.H1("6. Обґрунтування вибору алгоритму"))
    b(body("Задача має такі властивості: вхід — лише чотири числа, класи впорядковані за "
           "середнім BPM, але всередині класу значення мають випадковий розкид tol, а на межах "
           "діапазонів (60 і 100 BPM) класи стикаються. Через це потрібен класифікатор, який "
           "по-перше, будує нелінійну межу, по-друге, повертає не лише клас, а й оцінку "
           "впевненості, по-третє, компактно зберігається та швидко працює в браузері. Нижче "
           "порівняно чотири підходи."))
    b(body("Зведене порівняння чотирьох підходів за критеріями, важливими для цього "
           "застосунку, наведено в таблиці 6; далі кожен підхід розглянуто докладніше."))
    b(tcap(6, "Порівняння підходів до класифікації ритмів"))
    b(table(
        ["Критерій", "Пороговий (частина 1)", "k-NN", "Softmax-регресія", "MLP 4–8–3 (обрано)"],
        [
            ["Нелінійна межа", "частково, за середнім", "так", "ні", "так"],
            ["Калібровані ймовірності", "ні", "частково", "так", "так (softmax)"],
            ["Розмір моделі", "кілька чисел", "усі приклади", "22 числа", "67 чисел, ~31,6 КБ"],
            ["Час інференсу вікна", "~мкс", "O(N·K)", "~мкс", "~десятки мкс"],
            ["Потреба в навчанні", "ні (підбір меж)", "ні", "так", "так"],
            ["Ручні ознаки", "межі low/high", "метрика, k", "mean, sd", "немає"],
            ["Стійкість до шуму tol", "низька", "середня", "середня", "висока"],
        ],
        [24, 22, 16, 18, 20], "T6", keep=True))

    b(body("Пороговий (евристичний) класифікатор першої частини обирав межі low/high у BPM "
           "перебором по сітці значень і класифікував вікно за середнім. Він працює за "
           "мікросекунди й не потребує навчання, але має принципові недоліки: рішення залежить "
           "лише від середнього, тому вікно з великим розкидом усередині класу може бути "
           "віднесене до сусіднього; межі підганяються під дискретну сітку, а не під дані; "
           "ймовірності відсутні, тому «впевненість» була штучною величиною; нарешті, будь-яка "
           "зміна діапазонів або одиниць вимірювання вимагала ручного переналаштування."
           ))
    b(body("k-найближчих сусідів (k-NN) не має етапу навчання: він зберігає всю навчальну "
           "вибірку і на прогнозі шукає k найближчих прикладів. Для 801 прикладу й 67 параметрів "
           "мережі це означає, що кожне вікно вимагає 801 відстані по 4 координатах, а файл "
           "моделі містить усі приклади. Крім того, k-NN чутливий до масштабу ознак і потребує "
           "окремого підбору k та метрики; для серії вікон час зростає лінійно й стає помітним "
           "на слабких машинах. Ймовірності в k-NN — це лише частки голосів, погано калібровані "
           "при k=3…5."))
    b(body("Логістична регресія (softmax-регресія) дає калібровані ймовірності та крихітну "
           "модель, але будує лінійну межу в просторі входів. Оскільки класи відрізняються "
           "рівнем BPM, лінійна межа за одним середнім працювала б непогано, проте шум tol і "
           "дворівневий характер послідовності роблять задачу нелінійною; для якісного "
           "результату довелося б вручну додавати ознаки (середнє, стандартне відхилення, "
           "максимум), тобто повертатися до ручного інжинірингу ознак."))
    b(body("Багатошарова мережа прямого поширення (MLP) поєднує потрібні властивості: один "
           "прихований шар із сигмоїдами будує нелінійні межі, вихід після softmax є розподілом "
           "ймовірностей, а вся модель — це 67 чисел (близько 31,6 КБ у JSON). Навчання "
           "виконується звичайним зворотним поширенням із моментом, яке реалізує Brain.js; "
           "інференс одного вікна — це 67 множень, тобто десятки мікросекунд. Для трьох добре "
           "роздільних класів такої мережі достатньо: збільшення кількості шарів не дає виграшу, "
           "але підвищує ризик перенавчання й ускладнює серіалізацію."))

    b(body("Обрано MLP 4–8–3 із сигмоїдним прихованим шаром і softmax на виході. Гіперпараметри "
           "підібрано з таких міркувань: 8 прихованих нейронів достатньо для трьох класів і "
           "дають запас для нелінійності, не створюючи надлишкової ємності; швидкість навчання "
           "0,3 і момент 0,1 забезпечують стійке зниження помилки за 1000 епох; дострокова "
           "зупинка вимкнена за замовчуванням, щоб користувач бачив повну криву навчання."))
    b(body("Перевірка на реальних даних застосунку (801 приклад у train, 201 у test, K=4, "
           "H=8, η=0,3, μ=0,1, 1000 епох, зерно 7) дала точність 95,0 %, macro-F1 0,950 і середню "
           "крос-ентропію 0,600. Помилка навчання знизилася з 0,0517 до 0,00377. Матриця "
           "помилок: брадикардія — 61 правильно, 6 як норма; норма — 63 правильно, 4 як "
           "тахікардія; тахікардія — 67 правильно. Усі помилки припадають на межі 60 і 100 BPM, "
           "що відповідає стиканню діапазонів класів. Метрики за класами наведено в таблиці 7."))
    b(tcap(7, "Результати оцінювання навченої моделі (201 тестовий приклад)"))
    b(table(
        ["Клас", "Precision", "Recall", "F1", "Support"],
        [
            ["bradycardia", "1,000", "0,910", "0,953", "67"],
            ["normal", "0,913", "0,940", "0,927", "67"],
            ["tachycardia", "0,944", "1,000", "0,971", "67"],
            ["macro avg / accuracy", "0,952", "0,950", "0,950", "201"],
        ],
        [30, 18, 18, 18, 16], "T7", keep=True))

    # ------------------------------------------------ 7. Технології
    b(gen.H1("7. Вибір технологій"))
    b(body("Застосунок побудовано на HTML5, CSS3 та JavaScript без фреймворків і без етапу "
           "збирання. Це не самоціль, а вимога методичних вказівок і практична необхідність: "
           "робота має відкриватися подвійним кліком по src/index.html, працювати без мережі та "
           "без встановлення Node.js. Відсутність збирання означає, що кожен модуль — це "
           "звичайний <script>, який виконується браузером безпосередньо."))
    b(body("Brain.js обрано як рушій нейронної мережі. Бібліотека написана на чистому JavaScript, "
           "не потребує WebAssembly, має простий API NeuralNetwork із параметрами inputSize, "
           "hiddenLayers, outputSize, підтримує learningRate, momentum, errorThresh, iterations, "
           "серіалізацію toJSON/fromJSON і працює як у браузері, так і в Node.js. Версію "
           "2.0.0-beta.24 вендоровано в src/lib/brain.js (547 339 байтів) і підключено звичайним "
           "тегом <script> перед скриптами застосунку. Це гарантує роботу офлайн: жодного CDN, "
           "жодного завантаження ваг чи модулів."))
    b(body("Альтернативи відхилено з конкретних причин. TensorFlow.js дає значно більший "
           "функціонал, але його браузерна збірка разом із WASM-бекендом вимірюється мегабайтами, "
           "а для багатопотоковості потрібні COOP/COEP-заголовки, недоступні на file://. ONNX "
           "Runtime Web вимагає окремих ваг і WASM-файлів. Власна реалізація зворотного поширення "
           "зменшила б розмір, але збільшила б ризик помилок у градієнтах, позбавила б "
           "перевіреного серіалізатора й моменту та вимагала б окремих тестів на чисельну "
           "стійкість."))
    b(body("Canvas 2D використовується для всіх графіків і для композитного зображення "
           "результату 1400×800. Це дає піксельний контроль, просту експортну логіку "
           "(toDataURL для PNG/JPG і власний 24-бітний BMP-енкодер) і не залежить від "
           "зовнішніх бібліотек. Web Workers забезпечують фонове навчання; деталі наведено в "
           "розділах 9–11. Node.js використовується лише як середовище тестів: 52 тести "
           "виконуються у vm-контексті з мінімальним шимом window і не потребують DOM."))
    b(body("Стек технологій і причини вибору зведено в таблиці 8."))
    b(tcap(8, "Технологічний стек застосунку"))
    b(table(
        ["Технологія", "Версія / обсяг", "Роль", "Причина вибору"],
        [
            ["HTML5", "—", "розмітка кроків і форм", "семантика, доступність, без збирання"],
            ["CSS3", "913 рядків", "тема, сітка, адаптивність", "без залежностей, дві "
             "медіа-точки"],
            ["JavaScript (ES2017+)", "12 модулів", "логіка застосунку", "виконується браузером "
             "без транспіляції"],
            ["Brain.js", "2.0.0-beta.24, 534,5 КБ", "навчання та інференс MLP", "чистий JS, "
             "offline, toJSON/fromJSON"],
            ["Canvas 2D", "—", "графіки, ЕКГ, експорт", "піксельний контроль, PNG/JPG/BMP"],
            ["Web Worker + Blob URL", "—", "фонове навчання", "не блокує UI, обхід file://"],
            ["Node.js + vm", "—", "тести (52)", "перевірка без браузера, швидкий цикл"],
        ],
        [23, 20, 26, 31], "T8"))
    b(body("На рисунку 4 показано навчання, що виконується у воркері: індикатор прогресу "
           "оновлюється щоепохи, а криві помилки й точності будуються після завершення. На "
           "рисунку 5 — результат розпізнавання послідовності зі смугами ймовірностей і "
           "таблицею вікон."))
    b(figure(4, 8.5, "Навчання у Web Worker: індикатор прогресу та криві помилки й точності"))
    b(figure(5, 8.5, "Результат розпізнавання: клас, упевненість, смуги ймовірностей і таблиця вікон"))

    # ------------------------------------------------ 8. Недоліки
    b(gen.H1("8. Недоліки та обмеження реалізації"))
    b(body("Реалізація свідомо обмежена рамками лабораторної роботи, тому має низку недоліків. "
           "Їх поділено на три групи: дані, модель і середовище виконання. Для кожного "
           "недоліку запропоновано спосіб усунення (таблиця 9)."))
    b(body("Дані. Набір повністю синтетичний: кожна послідовність складається лише з двох рівнів "
           "Tmax і Tmin, тоді як реальна ритмограма має тренд, дихальну аритмію, екстрасистоли "
           "та артефакти. Через це мережа не бачить реального розподілу і на клінічних даних "
           "працюватиме гірше. Крім того, діапазони класів стикаються на 60 і 100 BPM, тому "
           "приклади з цих значень фактично належать двом класам; модель розв’язує конфлікт "
           "ймовірнісно, і саме на цих межах виникли всі 10 помилок у тесті."))
    b(body("Модель. Одна прихована шарова мережа з 8 нейронами має обмежену ємність: вона добре "
           "розділяє три компактні класи, але не змоделює складнішої структури, наприклад "
           "переміжної тахікардії чи фібриляції. Brain.js не має dropout, L2-регуляризації та "
           "батч-нормалізації, тому єдиними засобами проти перенавчання залишаються мала "
           "мережа, дострокова зупинка та збільшення вибірки. Softmax застосовується до "
           "сигмоїдних виходів уже після навчання, тому ймовірності не калібровані строго: "
           "вони впорядковані правильно, але їхня абсолютна величина не є частотою."))
    b(body("Середовище. Застосунок працює лише в браузері, без GPU і без збереження стану між "
           "перезавантаженнями: набір даних і модель зберігаються у файли, а не в IndexedDB. "
           "Обмеження file:// змушує формувати воркер із Blob-URL і вбудовувати в нього текст "
           "Brain.js; це дублює бібліотеку в пам’яті (основна копія та рядок brain-src.js, "
           "близько 1,1 МБ разом) і ускладнює налагодження, бо стек воркера показує blob:-URL. "
           "Якщо браузер блокує створення воркера, навчання виконується на головному потоці "
           "частками, що повільніше й може помітно навантажувати процесор."))
    b(tcap(9, "Недоліки реалізації та способи їх усунення"))
    b(table(
        ["Недолік", "Наслідок", "Спосіб усунення"],
        [
            ["Синтетичні дані з двома рівнями", "розрив із реальною ЕКГ", "імпорт MIT-BIH / "
             "PhysioNet, аугментація, додавання тренду й шуму"],
            ["Перекриття діапазонів на 60 і 100 BPM", "помилки саме на межах", "напіввідкриті "
             "інтервали, гістерезис, окремий клас «невизначено»"],
            ["Мала ємність (4–8–3)", "не моделює складні аритмії", "до 64 нейронів, два шари, "
             "підбір за валідацією"],
            ["Немає dropout / L2", "ризик перенавчання", "дострокова зупинка, більший набір, "
             "ансамбль моделей"],
            ["Неповна калібрація ймовірностей", "завищена впевненість", "temperature scaling або "
             "ізотонічна регресія на валідації"],
            ["Фіксоване вікно K=4", "немає довгого контексту", "вікна змінного розміру, 1D-CNN "
             "або RNN"],
            ["Локальність у браузері", "немає GPU, стан не зберігається", "WebGL/WASM-бекенд, "
             "IndexedDB для сесії"],
            ["Обмеження file:// для воркера", "Blob-URL, дублювання джерела", "локальний сервер "
             "із COOP/COEP, окремий файл воркера"],
            ["Навчання 1000 епох ~5 с", "повільний цикл експериментів", "менше епох із "
             "достроковою зупинкою, кешування даних"],
        ],
        [30, 30, 40], "T9"))

    # ------------------------------------------------ 9. Аналіз паралельності
    b(gen.H1("9. Аналіз можливості паралельного виконання"))
    b(body("Робочий процес складається з п’яти етапів: генерація набору, кодування, навчання, "
           "оцінювання та візуалізація. Між ними є жорсткі залежності за даними: не можна "
           "кодувати те, чого немає, не можна оцінити ненавчену модель, а намалювати результат "
           "можна лише після прогнозу. Тому паралелізм можливий не між етапами, а всередині них "
           "або як винесення цілого етапу в інший потік."))
    b(body("Зведений аналіз етапів за ступенем доступного паралелізму наведено в таблиці 10."))
    b(tcap(10, "Аналіз етапів щодо паралельного виконання"))
    b(table(
        ["Етап", "Залежності", "Доцільність", "Рішення"],
        [
            ["Генерація", "незалежні приклади", "низька", "послідовно (мс)"],
            ["Кодування", "після генерації", "низька", "послідовно (мкс)"],
            ["Навчання", "епохи послідовні", "висока (~95 %)", "Web Worker"],
            ["Оцінювання", "після навчання", "низька (2 мс)", "послідовно"],
            ["Візуалізація", "після прогнозу, DOM", "неможлива", "головний потік"],
        ],
        [17, 27, 22, 34], "T10", keep=True))


    b(body("Генерація незалежна для кожного класу й кожного прикладу, тому теоретично "
           "розпаралелюється ідеально. Проте 1002 послідовності по 4 числа генеруються за "
           "одиниці мілісекунд, і накладні витрати на створення потоків або передачу "
           "повідомлень перевищили б виграш у десятки разів. Кодування — це 4008 ділень і "
           "clamp-операцій, тобто мікросекунди; воно також недоцільне для паралелізму."))
    b(body("Навчання — єдиний справді тривалий етап. Одна епоха — це прямий і зворотний прохід "
           "по 801 прикладу: близько 112 множень на приклад, тобто ~9·10^7 операцій за 1000 "
           "епох. У вимірюванні на головному потоці це зайняло 4,9 с. Епохи послідовні за "
           "своєю природою (кожна наступна залежить від ваг після попередньої), тому "
           "розпаралелити їх не можна. Всередині епохи приклади незалежні, але Brain.js виконує "
           "прохід синхронно й оновлює ваги після кожного прикладу; для розподілу цієї роботи "
           "між потоками потрібна спільна пам’ять (SharedArrayBuffer) і атомарні операції, "
           "недоступні на file:// без спеціальних заголовків. Отже, практичний паралелізм тут — "
           "це винесення всього циклу навчання в окремий потік, а не розподіл епохи."))
    b(body("Оцінювання тестової вибірки містить 201 прогноз і 402 вікна; у вимірюванні це "
           "2 мс, тому паралелити його немає сенсу. Візуалізація жорстко прив’язана до "
           "canvas і DOM, які доступні лише головному потоку."))
    b(body("З погляду закону Амдала, частка навчання в загальному часі перевищує 95 %, тож "
           "винесення саме цього етапу дає максимальний ефект. Але головна мета — не стільки "
           "прискорення, скільки відгукливість: під час навчання інтерфейс має реагувати на "
           "рух миші, прокручування та кнопку «Stop». Навіть одне фонове ядро забезпечує це "
           "повністю, бо головний потік зайнятий лише обробкою повідомлень прогресу."))
    # ------------------------------------------------ 10. Технологія
    b(gen.H1("10. Паралельність залежно від технології"))
    b(body("У браузері є кілька механізмів конкурентного виконання, і кожен має обмеження. "
           "Найпростіший — розбиття роботи на порції через setTimeout або requestAnimationFrame: "
           "цикл віддає керування браузеру кожні 16 мс, інтерфейс встигає перемалюватися, але "
           "обчислення все одно виконуються на тому самому ядрі й конкурують із рендерингом. "
           "Саме так працює резервний режим trainChunked."))
    b(body("Варіанти організації паралельних обчислень у браузері та їхні обмеження зведено "
           "в таблиці 11."))
    b(tcap(11, "Варіанти організації паралельних обчислень"))
    b(table(
        ["Технологія", "Переваги", "Обмеження", "Використання"],
        [
            ["setTimeout / rAF-чанки", "працює всюди, простий код", "той самий потік, конкурує "
             "з рендерингом", "резервний режим"],
            ["Dedicated Worker", "справжній паралелізм, ізоляція", "немає DOM, потрібен Blob на "
             "file://", "основний режим"],
            ["SharedArrayBuffer", "спільна пам’ять, паралельний SGD", "потрібні COOP/COEP, "
             "складна синхронізація", "не використано"],
            ["WASM threads", "висока швидкість", "окрема збірка й завантаження", "не використано"],
            ["WebGL", "GPU-прискорення", "складна реалізація backprop", "не використано"],
            ["Node worker_threads", "зручно для CLI", "немає в браузері", "лише тести"],
        ],
        [22, 27, 33, 18], "T11", keep=True))

    b(body("Web Worker — окремий потік із власним циклом подій, без доступу до DOM. Обмін даними "
           "відбувається через postMessage із структурованим клонуванням. Це саме те, що "
           "потрібно навчанню: воно не торкається DOM, а лише повертає числа. Обмеження "
           "полягає в тому, що на file:// сторінка має походження null, і Chromium забороняє "
           "new Worker(\"src/js/train-worker.js\") та importScripts(\"file://…\"). Тому "
           "використано Blob-URL: джерело воркера формується в пам’яті як рядок, і воркер "
           "створюється з URL.createObjectURL(new Blob([...]))."));
    b(body("Щоб воркер мав доступ до Brain.js, у blob вбудовується текст бібліотеки. Файл "
           "src/lib/brain-src.js присвоює window.__BRAIN_SOURCE__ той самий код, що лежить у "
           "brain.js; model.js бере цей рядок і додає до нього текст функції workerMain, "
           "серіалізований через toString(). У результаті у воркері є глобальний об’єкт brain, "
           "і жодного мережевого або файлового завантаження не відбувається."))
    b(body("SharedArrayBuffer і Atomics дозволили б спільну пам’ять і паралельний SGD, але "
           "вимагають заголовків COOP/COEP, які неможливо виставити для file://, а також "
           "переписування ядра Brain.js. WASM-потоки потребують окремої збірки й завантаження "
           "модуля. WebGL міг би прискорити множення матриць, але реалізація зворотного "
           "поширення на шейдерах виходить за межі роботи. Service Worker не призначений для "
           "обчислень і не має доступу до сторінки синхронно. Node worker_threads працює лише "
           "в тестах і не є частиною браузерного застосунку."))
    b(body("Протокол обміну повідомленнями між model.js і воркером наведено в таблиці 12. "
           "Окремого повідомлення ініціалізації немає: джерело Brain.js уже вбудоване у blob, "
           "тому першим повідомленням є train."))
    b(tcap(12, "Протокол повідомлень Web Worker"))
    b(table(
        ["Напрям", "type", "Поля", "Призначення"],
        [
            ["main → worker", "train", "data {train, test}; config {epochs, errorThresh, "
             "learningRate, momentum, hidden, layers, keys}; evalEvery; trainSize, testSize",
             "запуск навчання"],
            ["worker → main", "progress", "epoch, error, trainAcc, testAcc",
             "оновлення індикатора та кривих"],
            ["worker → main", "done", "netJSON, history", "передача ваг та історії"],
            ["worker → main", "error", "message", "повідомлення про збій"],
            ["main → worker", "stop", "—", "зупинка після поточної епохи"],
        ],
        [18, 13, 45, 24], "T12", keep=True))

    # ------------------------------------------------ 11. Приклад
    b(gen.H1("11. Практичний приклад паралельного виконання"))
    b(body("Нижче наведено реальні фрагменти реалізації, які виконуються в застосунку. Спочатку "
           "модель готує шари, конфігурацію та закодовані дані, потім створює воркер із "
           "Blob-URL, надсилає йому завдання й пересилає прогрес в інтерфейс."))
    b(code_raw(
        "// src/js/model.js — підготовка даних і запуск навчання\n"
        "const layers = { inputSize: this.k, hiddenLayers: [this.hidden],\n"
        "                 outputSize: keys.length };          // 4 - 8 - 3\n"
        "const config = { epochs, errorThresh, learningRate: this.learningRate,\n"
        "                 momentum: this.momentum, hidden: this.hidden, layers, keys };\n"
        "const data = { train: encodeSet(trainSet, this), test: encodeSet(testSet, this) };\n"
        "const evalEvery = Math.max(1, Math.round(epochs / 100));\n"
        "this.net = new brain.NeuralNetwork(layers);\n"
        "const worker = this.trainInWorker(data, config, evalEvery, hooks);\n"
        "const done = worker ? await worker : null;\n"
        "if (done && done.netJSON) {\n"
        "    this.net.fromJSON(done.netJSON);   // ваги з воркера\n"
        "    this.history = done.history;       // історія з воркера\n"
        "    this.trainPath = \"worker\";\n"
        "} else {\n"
        "    await this.trainChunked(data, config, evalEvery, hooks);  // резерв\n"
        "    this.trainPath = \"main-thread\";\n"
        "}",
        "Фрагмент 1 — model.js: підготовка та вибір шляху навчання"))
    b(body("Ключове місце — формування джерела воркера. Текст Brain.js і функція workerMain "
           "склеюються в один скрипт; функція викликається одразу після бібліотеки, тому "
           "глобальний brain уже існує."))
    b(code_raw(
        "// src/js/model.js — створення воркера без файлового URL\n"
        "const WorkerCtor = (g && g.Worker) || window.Worker || null;\n"
        "const main = AIIP.trainWorkerMain;              // функція з train-worker.js\n"
        "const source = getBrainSource();                // window.__BRAIN_SOURCE__\n"
        "if (typeof WorkerCtor !== \"function\" || typeof main !== \"function\" || !source)\n"
        "    return null;                                // -> резервний режим\n"
        "const src = source + \"\\n;(\" + main.toString() + \")();\\n\";\n"
        "const url = URL.createObjectURL(new Blob([src], { type: \"text/javascript\" }));\n"
        "const worker = new WorkerCtor(url);             // blob:..., а не file://\n"
        "worker.postMessage({ type: \"train\", data, config, evalEvery,\n"
        "                     trainSize: this.trainSize, testSize: this.testSize });",
        "Фрагмент 2 — model.js: Blob-URL воркер із вбудованим Brain.js"))
    b(body("Воркер виконує по одній епосі за ітерацію, тому після кожної епохи може надіслати "
           "прогрес і перевірити прапорець зупинки. Пауза setTimeout(0) потрібна, щоб черга "
           "повідомлень оброблялася навіть тоді, коли епоха коротка."))
    b(code_raw(
        "// src/js/train-worker.js — цикл навчання у фоновому потоці\n"
        "const net = new brain.NeuralNetwork(cfg.layers);\n"
        "const trainOpts = { iterations: 1, learningRate: cfg.learningRate,\n"
        "                    momentum: cfg.momentum, log: false };\n"
        "for (let e = 1; e <= cfg.epochs; e++) {\n"
        "    const res = net.train(data.train.rows, trainOpts);\n"
        "    const error = res.error;\n"
        "    if (e === 1 || e % evalEvery === 0 || e === cfg.epochs) {\n"
        "        trainAcc = accuracy(net, data.train, cfg.keys);\n"
        "        testAcc  = accuracy(net, data.test,  cfg.keys);\n"
        "    }\n"
        "    self.postMessage({ type: \"progress\", epoch: e, error, trainAcc, testAcc });\n"
        "    if (stop || (cfg.errorThresh > 0 && error <= cfg.errorThresh))\n"
        "        break;\n"
        "    if (Date.now() - lastYield > 16) { await pause(); lastYield = Date.now(); }\n"
        "}\n"
        "self.postMessage({ type: \"done\", netJSON: net.toJSON(), history });",
        "Фрагмент 3 — train-worker.js: епоха, прогрес і завершення"))
    b(body("На головному потоці прогрес перетворюється на відсоток виконання та текст статусу, "
           "а вимога зупинки пересилається у воркер. Після завершення воркер припиняється, а "
           "Blob-URL звільняється, щоб не тримати мегабайтний рядок у пам’яті."))
    b(code_raw(
        "// src/js/model.js — обробка повідомлень воркера\n"
        "worker.onmessage = (ev) => {\n"
        "    bump();                                   // тайм-аут простою 120 с\n"
        "    const msg = ev.data || {};\n"
        "    if (msg.type === \"progress\") {\n"
        "        hooks.onEpoch({ epoch: msg.epoch, epochs: config.epochs, error: msg.error,\n"
        "                        trainAcc: msg.trainAcc, testAcc: msg.testAcc });\n"
        "        if (hooks.shouldStop && hooks.shouldStop())\n"
        "            worker.postMessage({ type: \"stop\" });\n"
        "    } else if (msg.type === \"done\") {\n"
        "        finish(msg);\n"
        "    } else if (msg.type === \"error\") {\n"
        "        finish(null);                         // -> резервний режим\n"
        "    }\n"
        "};\n"
        "// finish(): clearTimeout, worker.terminate(), URL.revokeObjectURL(url)",
        "Фрагмент 4 — model.js: протокол progress / done / stop"))
    b(body("Резервний режим повторює ту саму логіку, але на головному потоці й порціями: після "
           "кожної епохи перевіряється, чи минуло 16 мс, і якщо так — керування повертається "
           "браузеру через await u.nextFrame(). Завдяки цьому навіть без воркера інтерфейс "
           "залишається працездатним, хоча навчання триває довше."))
    b(code_raw(
        "// src/js/model.js — резервне покрокове навчання\n"
        "for (let e = 1; e <= config.epochs; e++) {\n"
        "    const error = net.train(data.train.rows, trainOpts).error;\n"
        "    this.recordProgress({ epoch: e, error, trainAcc, testAcc });\n"
        "    if (hooks.onEpoch) hooks.onEpoch({ epoch: e, epochs: config.epochs, error,\n"
        "                                      trainAcc, testAcc });\n"
        "    if (config.errorThresh > 0 && error <= config.errorThresh) break;\n"
        "    if (hooks.shouldStop && hooks.shouldStop()) break;\n"
        "    if (now() - lastYield > 16) { await u.nextFrame(); lastYield = now(); }\n"
        "}",
        "Фрагмент 5 — model.js: резервний цикл із поверненням керування"))
    b(body("Послідовність роботи механізму така: 1) користувач натискає «Train»; 2) train-step "
           "зчитує параметри, перевіряє їх і викликає model.train; 3) модель кодує вибірки й "
           "створює воркер; 4) воркер навчає мережу й надсилає progress; 5) головний потік "
           "оновлює індикатор, журнал і, за потреби, надсилає stop; 6) воркер повертає done із "
           "вагами; 7) модель відновлює ваги, зберігає історію та позначає шлях як worker; "
           "8) train-step обчислює метрики на тесті й будує криві. Якщо крок 3 або 4 не вдався, "
           "виконується той самий алгоритм у режимі main-thread без повідомлення про помилку."))
    b(body("Практична перевірка: під час навчання 1000 епох індикатор оновлюється щоепохи, "
           "кнопка «Stop» реагує після поточної епохи, а прокручування сторінки не завмирає. "
           "У Node-тестах, де Worker відсутній, автоматично виконується резервний шлях, і всі "
           "52 тести проходять. На рисунку 6 показано воркер у вкладці Sources інструментів "
           "розробника, на рисунку 7 — збережений файл моделі з вагами."))
    b(figure(6, 8.0, "Blob-URL воркер у вкладці Sources: джерело Brain.js і функція workerMain"))
    b(figure(7, 6.5, "Збережений файл моделі: формат aiip-model, версія 2, рушій brain.js і ваги"))

    # ------------------------------------------------ 12. Висновок
    b(gen.H1("12. Висновок"))
    b(body("У другій частині лабораторної роботи пороговий класифікатор замінено на нейронну "
           "мережу прямого поширення 4–8–3 бібліотеки Brain.js 2.0.0-beta.24. Реалізовано повний "
           "алгоритм: генерація послідовностей за формулою методичних вказівок, нормування "
           "входу до 0…1 із збереженням меж кодування, унітарне кодування класів, навчання з "
           "моментом, достроковою та ручною зупинкою, softmax-інтерпретація виходів і ковзне "
           "вікно для довших послідовностей."))
    b(body("Публічний інтерфейс моделі залишено незмінним, тому графічний інтерфейс, "
           "збереження й завантаження моделі, журнал і всі три кроки працюють без переписування. "
           "Навчання виконується у Web Worker, створеному через Blob-URL із вбудованим текстом "
           "бібліотеки, що обходить заборону file:// на файлові воркери; резервний покроковий "
           "режим гарантує працездатність там, де воркер недоступний."))
    b(body("Експеримент на 801 навчальному й 201 тестовому прикладі дав точність 95,0 %, "
           "macro-F1 0,950 і середню крос-ентропію 0,600; модель містить 67 параметрів і "
           "зберігається у JSON близько 31,6 КБ. Усі помилки локалізовані на межах діапазонів "
           "60 і 100 BPM, що вказує на головний напрям подальшого вдосконалення — усунення "
           "перекриття класів і перехід до реальних записів ЕКГ."))
    b(body("Отже, мету роботи досягнуто: алгоритм створено й застосовано, архітектуру "
           "обґрунтовано, а паралельне навчання реалізовано."))
    b(P("BodyFirst", "Вихідний код застосунку доступний у репозиторії:"))
    b(PX("BodyCenter", gen.A("https://github.com/danylo-volchenko/poly-aiip",
                             "https://github.com/danylo-volchenko/poly-aiip")))

    return "".join(out)


# --------------------------------------------------------------- build
def make_content(pages):
    """Like gen.make_content, but the body is built BEFORE the automatic
    styles are serialised (table column styles are registered while building)."""
    prefix = gen.load_prefix()
    seq = ('<text:sequence-decls><text:sequence-decl text:display-outline-level="0" '
           'text:name="Illustration"/><text:sequence-decl text:display-outline-level="0" '
           'text:name="Table"/><text:sequence-decl text:display-outline-level="0" '
           'text:name="Text"/><text:sequence-decl text:display-outline-level="0" '
           'text:name="Drawing"/><text:sequence-decl text:display-outline-level="0" '
           'text:name="Figure"/></text:sequence-decls>')
    body = build_body(pages)
    return (prefix
            + "<office:automatic-styles>" + "".join(gen.STYLES) + "</office:automatic-styles>"
            + '<office:body><office:text text:use-soft-page-breaks="true">'
            + seq + body
            + "</office:text></office:body></office:document-content>")


def main():
    pages = {}
    if os.path.exists(PAGES_JSON):
        try:
            with open(PAGES_JSON, encoding="utf-8") as f:
                pages = json.load(f)
        except Exception:
            pages = {}
    gen.build_body = build_body
    gen.make_content = make_content
    gen.build(pages, OUT_ODT)
    print("wrote", OUT_ODT, os.path.getsize(OUT_ODT), "bytes;",
          "pages known:", len(pages))


if __name__ == "__main__":
    main()
