#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Generate the AIIP Lab-3 (Part 3: Тестування та бенчмарки) report as ODT.

Reuses the Lab-1 pipeline (gen.py): template styles, paragraph/table/TOC
helpers and the ODT packaging.  Lab-3 adds: a compact table style for the
wide "all five runs" tables, real embedded PNG figures (Pictures/ + manifest)
and the Lab-3 outline.  Captions: figures below the frame, tables above.
"""
import json
import os
import re
import statistics
import sys
import zipfile

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import gen  # noqa: E402  (reused pipeline)

REPO = os.path.abspath(os.path.join(HERE, "..", "..", ".."))
RESULTS = os.environ.get("LAB3_RESULTS", os.path.join(REPO, "bench", "results.json"))
FIG_DIR = os.environ.get("LAB3_FIG_DIR", os.path.join(REPO, "bench", "figures"))
OUT_ODT = os.environ.get(
    "LAB_OUT_ODT",
    "/home/wired/Documents/poly/AIIP-LAB3_Volchenko_PZIP-11_звіт.odt",
)
PAGES_JSON = os.environ.get("LAB3_PAGES", os.path.join(HERE, "pages-lab3.json"))

P = gen.P
PX = gen.PX
st = gen.st
pagebreak = gen.pagebreak

TABLE_W_CM = 16.5
FIG_W = "16.4cm"

# --------------------------------------------------------------- extra styles
st('<style:style style:name="H3" style:family="paragraph" style:parent-style-name="Heading">'
   '<style:paragraph-properties fo:text-align="left" fo:line-height="125%" fo:margin-top="0.3cm" '
   'fo:margin-bottom="0.12cm" fo:keep-with-next="always" style:justify-single-word="false"/>'
   '<style:text-properties style:font-name="Times New Roman" fo:font-size="12pt" fo:font-weight="bold" '
   'style:font-size-asian="12pt" style:font-size-complex="12pt" style:font-weight-asian="bold" '
   'style:font-weight-complex="bold"/></style:style>')

st('<style:style style:name="TableCaption" style:family="paragraph" style:parent-style-name="Standard">'
   '<style:paragraph-properties fo:text-align="right" fo:line-height="120%" fo:margin-top="0.25cm" '
   'fo:margin-bottom="0.1cm" fo:keep-with-next="always" style:justify-single-word="false"/>'
   '<style:text-properties style:font-name="Times New Roman" fo:font-size="14pt" fo:font-style="italic" '
   'style:font-size-asian="14pt" style:font-size-complex="14pt" style:font-style-asian="italic" '
   'style:font-style-complex="italic"/></style:style>')

st('<style:style style:name="FigCaption" style:family="paragraph" style:parent-style-name="Standard">'
   '<style:paragraph-properties fo:text-align="center" fo:line-height="120%" fo:margin-top="0.1cm" '
   'fo:margin-bottom="0.35cm" style:justify-single-word="false"/>'
   '<style:text-properties style:font-name="Times New Roman" fo:font-size="14pt" fo:font-style="italic" '
   'style:font-size-asian="14pt" style:font-size-complex="14pt" style:font-style-asian="italic" '
   'style:font-style-complex="italic"/></style:style>')

# title and TOC open header-less master pages; body then uses Standard with the
# page number in the top-right corner.  PAGE is not restarted, so body starts at 3.
st('<style:style style:name="TitleStart" style:family="paragraph" style:parent-style-name="TitleLine" '
   'style:master-page-name="First_20_Page"><style:paragraph-properties/></style:style>')

st('<style:style style:name="FigFrame" style:family="paragraph" style:parent-style-name="BodyCenter">'
   '<style:paragraph-properties fo:text-align="center" fo:line-height="100%" fo:keep-with-next="always" '
   'style:justify-single-word="false"/></style:style>')

# compact text for the 10-column result tables (8.5 pt is enough at 16.5 cm)
st('<style:style style:name="TableHeadSmall" style:family="paragraph" style:parent-style-name="Standard">'
   '<style:paragraph-properties fo:text-align="center" fo:line-height="105%" style:justify-single-word="false"/>'
   '<style:text-properties style:font-name="Times New Roman" fo:font-size="8.5pt" fo:font-weight="bold" '
   'style:font-size-asian="8.5pt" style:font-size-complex="8.5pt" style:font-weight-asian="bold" '
   'style:font-weight-complex="bold"/></style:style>')
st('<style:style style:name="TableCellSmall" style:family="paragraph" style:parent-style-name="Standard">'
   '<style:paragraph-properties fo:text-align="right" fo:line-height="105%" style:justify-single-word="false"/>'
   '<style:text-properties style:font-name="Times New Roman" fo:font-size="8.5pt" '
   'style:font-size-asian="8.5pt" style:font-size-complex="8.5pt"/></style:style>')
st('<style:style style:name="TableCellSmallLeft" style:family="paragraph" style:parent-style-name="TableCellSmall">'
   '<style:paragraph-properties fo:text-align="left"/></style:style>')

st('<style:style style:name="TCellSmall" style:family="table-cell">'
   '<style:table-cell-properties fo:padding="0.06cm" fo:border="0.5pt solid #000000" style:vertical-align="middle"/></style:style>')
st('<style:style style:name="TCellHeadSmall" style:family="table-cell">'
   '<style:table-cell-properties fo:padding="0.06cm" fo:border="0.5pt solid #000000" fo:background-color="#e8e8e8" style:vertical-align="middle"/></style:style>')

st('<style:style style:name="TRow" style:family="table-row">'
   '<style:table-row-properties fo:keep-together="always"/></style:style>')

st('<style:style style:name="FigImg" style:family="graphic" style:parent-style-name="Graphics">'
   '<style:graphic-properties draw:stroke="none" draw:fill="none" fo:padding="0cm" '
   'style:vertical-pos="top" style:vertical-rel="baseline" style:horizontal-pos="center" '
   'style:horizontal-rel="paragraph"/></style:style>')

# screenshot placeholder: dashed single-cell table + caption row in one table, so
# the placeholder and its caption never separate and the border is reliably drawn
st('<style:style style:name="PHTable" style:family="table">'
   '<style:table-properties style:width="16.4cm" table:align="center" '
   'fo:margin-top="0.15cm" fo:margin-bottom="0.35cm"/></style:style>')
st('<style:style style:name="PHCol" style:family="table-column">'
   '<style:table-column-properties style:column-width="16.4cm"/></style:style>')
st('<style:style style:name="PHCell" style:family="table-cell">'
   '<style:table-cell-properties fo:padding="0.15cm" fo:border="0.6pt dashed #9a9a9a" '
   'style:vertical-align="middle"/></style:style>')
st('<style:style style:name="PHCaptionCell" style:family="table-cell">'
   '<style:table-cell-properties fo:padding="0.03cm" fo:border="none" '
   'style:vertical-align="top"/></style:style>')
st('<style:style style:name="PHRowCap" style:family="table-row">'
   '<style:table-row-properties fo:keep-together="always"/></style:style>')

# --------------------------------------------------------------- TOC definition
TOC_ITEMS = [
    "1. Тема",
    "2. Постановка завдання",
    "3. Мета роботи",
    "4. Умови проведення бенчмарку",
    "5. Підготовка тестових даних",
    "6. Методика вимірювання",
    "7. Повторюваність і статистична обробка",
    "8. Параметри бенчмарку",
    "9. Результати вимірювань",
    "10. Візуалізація результатів",
    "11. Аналіз результатів",
    "12. Покращення продуктивності",
    "13. Висновок",
]

# --------------------------------------------------------------- canonical data
with open(RESULTS, encoding="utf-8") as _fh:
    DATA = json.load(_fh)

CASES = {}
for _c in DATA["cases"]:
    CASES.setdefault(_c["id"], []).append(_c)


def num(x, nd=3):
    return ("%.*f" % (nd, x)).replace(".", ",")


def pct(x):
    return (("%.2f" % x).replace(".", ",")) + " %"


def mean_case(case):
    return statistics.mean(case["runs"])


def cv_case(case):
    return 100.0 * statistics.pstdev(case["runs"]) / mean_case(case)


def ratio_case(case):
    return max(case["runs"]) / min(case["runs"])


def fit(cases, key):
    xs = [float(c["params"][key]) for c in cases]
    ys = [mean_case(c) for c in cases]
    n = len(xs)
    mx = sum(xs) / n
    my = sum(ys) / n
    sxx = sum((x - mx) ** 2 for x in xs)
    sxy = sum((x - mx) * (y - my) for x, y in zip(xs, ys))
    slope = sxy / sxx
    intercept = my - slope * mx
    pred = [slope * x + intercept for x in xs]
    ss_res = sum((y - p) ** 2 for y, p in zip(ys, pred))
    ss_tot = sum((y - my) ** 2 for y in ys)
    r2 = 1.0 - ss_res / ss_tot if ss_tot else 1.0
    return slope, intercept, r2


# --------------------------------------------------------------- tables
def table(headers, rows, widths, name="Tbl", small=False, keep=True):
    total = sum(widths)
    coldefs = []
    cells_head = []
    for i, w in enumerate(widths):
        cm = round(TABLE_W_CM * w / total, 3)
        cs = "TCol_%s_%d" % (name, i)
        st('<style:style style:name="%s" style:family="table-column">'
           '<style:table-column-properties style:column-width="%scm"/></style:style>' % (cs, cm))
        coldefs.append('<table:table-column table:style-name="%s"/>' % cs)
    hcell = "TCellHeadSmall" if small else "TCellHead"
    htext = "TableHeadSmall" if small else "TableHead"
    for h in headers:
        cells_head.append('<table:table-cell table:style-name="%s">%s</table:table-cell>'
                          % (hcell, P(htext, h)))
    header_row = ('<table:table-header-rows><table:table-row table:style-name="TRow">'
                  + "".join(cells_head) + "</table:table-row></table:table-header-rows>")
    body_rows = []
    for r in rows:
        cells = []
        for i, c in enumerate(r):
            style = "TableCellSmall" if small else "TableCell"
            if small and i == 0:
                style = "TableCellSmallLeft"
            cells.append('<table:table-cell table:style-name="%s">%s</table:table-cell>'
                         % ("TCellSmall" if small else "TCell", P(style, str(c))))
        body_rows.append('<table:table-row table:style-name="TRow">%s</table:table-row>'
                         % "".join(cells))
    keep_attr = ' table:may-break-between-rows="false"' if keep else ""
    return ('<table:table table:name="%s" table:style-name="TblStyle"%s>'
            % (name, keep_attr)
            + "".join(coldefs) + header_row + "".join(body_rows) + "</table:table>")


def tcap(n, text):
    return P("TableCaption", "Таблиця %d. %s" % (n, text))


def body(text):
    return P("Body", text)


def first(text):
    return P("BodyFirst", text)


def bullets(items):
    inner = "".join('<text:list-item>%s</text:list-item>' % P("ListItem", it) for it in items)
    return '<text:list text:style-name="LBullet">%s</text:list>' % inner


def nums(items):
    inner = "".join('<text:list-item>%s</text:list-item>' % P("ListItem", it) for it in items)
    return '<text:list text:style-name="LNum">%s</text:list>' % inner


def image_figure(n, filename, width_cm, height_cm, cap):
    frame = ('<draw:frame draw:name="Рисунок%d" text:anchor-type="as-char" '
             'svg:width="%scm" svg:height="%scm" draw:style-name="FigImg">'
             '<draw:image xlink:href="Pictures/%s" xlink:type="simple" '
             'xlink:show="embed" xlink:actuate="onLoad"/>'
             '</draw:frame>' % (n, width_cm, height_cm, filename))
    return PX("FigFrame", frame) + P("FigCaption", "Рис. %d. %s" % (n, cap))


def shot(n, height_cm, cap):
    rstyle = "PHRow%d" % n
    st('<style:style style:name="%s" style:family="table-row">'
       '<style:table-row-properties style:use-optimal-row-height="false" '
       'style:row-height="%scm" fo:keep-together="always"/></style:style>' % (rstyle, height_cm))
    return ('<table:table table:name="PH%d" table:style-name="PHTable" '
            'table:may-break-between-rows="false">'
            '<table:table-column table:style-name="PHCol"/>'
            '<table:table-row table:style-name="%s">'
            '<table:table-cell table:style-name="PHCell">%s</table:table-cell>'
            '</table:table-row>'
            '<table:table-row table:style-name="PHRowCap">'
            '<table:table-cell table:style-name="PHCaptionCell">%s</table:table-cell>'
            '</table:table-row></table:table>'
            % (n, rstyle, P("PHText", "[МІСЦЕ ДЛЯ СКРІНШОТА]"),
               P("FigCaption", "Рис. %d. %s" % (n, cap))))


# --------------------------------------------------------------- body
def build_body(pages):
    out = []
    b = out.append

    inf = CASES["inference"]
    ev = CASES["evaluation"]
    tr = CASES["training"]
    wk = CASES["window-k"]
    ep = CASES["epochs"]
    wr = CASES["worker-main"][0]

    sl_inf, ic_inf, r2_inf = fit(inf, "n")
    sl_ev, ic_ev, r2_ev = fit(ev, "samples")
    sl_tr, ic_tr, r2_tr = fit(tr, "samples")
    sl_wk, ic_wk, r2_wk = fit(wk, "k")
    sl_ep, ic_ep, r2_ep = fit(ep, "epochs")
    k_gain = mean_case(wk[-1]) / mean_case(wk[0])

    # ------------------------------------------------ title page
    b(P("TitleStart", "Міністерство освіти і науки України"))
    b(P("TitleLine", "Національний університет «Львівська Політехніка»"))
    b(P("TitleLine", "Інститут комп’ютерних наук та інформаційних технологій"))
    b(P("TitleLine", "Кафедра програмного забезпечення"))
    for _ in range(5):
        b(P("TitleLine"))
    b(P("TitleBig", "Звіт до лабораторної роботи №3"))
    b(P("TitleLine", "З дисципліни: «Опрацювання зображень методами штучного інтелекту»"))
    b(P("TitleTopic", "на тему: «Розпізнавання серцевих ритмів за допомогою нейронної мережі. "
                     "Частина 3. Тестування та бенчмарки»"))
    b(P("TitleTopic", "Варіант - 6"))
    for _ in range(3):
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
    for text in TOC_ITEMS:
        b(PX("TocEntry", gen.esc(text) + "<text:tab/>" + str(pages.get(text, "0"))))
    b(pagebreak())

    # ------------------------------------------------ 1. Тема
    b(gen.H1("1. Тема"))
    b(body("Розпізнавання серцевих ритмів (нормальний синусовий ритм, тахікардія, брадикардія) "
           "за допомогою нейронної мережі. Частина 3. Тестування та бенчмарки."))
    b(body("У першій частині роботи розроблено графічний інтерфейс застосунку, у другій — "
           "пороговий класифікатор замінено на нейронну мережу прямого поширення 4–8–3 "
           "бібліотеки Brain.js і реалізовано навчання у Web Worker. У третій частині "
           "досліджується продуктивність готового застосунку: вимірюється час прогнозування, "
           "оцінювання та навчання за різних обсягів вхідних даних, аналізується характер "
           "масштабування, визначаються вузькі місця та пропонуються способи їх усунення."))
    b(body("Темою роботи є саме вимірювання та аналіз, а не зміна алгоритму класифікації: "
           "публічний інтерфейс моделі, генератор даних і сценарій роботи користувача "
           "залишаються тими самими, що й у другій частині."))

    # ------------------------------------------------ 2. Постановка
    b(gen.H1("2. Постановка завдання"))
    b(body("Варіант 6: згенерувати послідовності по 4 числа, що відображають ритми "
           "нормального серця (60–100 BPM), серця швидкого — тахікардію (100–140 BPM) і серця "
           "повільного — брадикардію (40–60 BPM), навчити на них просту мережу та розпізнавати "
           "послідовності на вході."))
    b(body("У межах третьої частини необхідно:"))
    b(nums([
        "виміряти час виконання основних операцій застосунку за різних обсягів вхідних даних;",
        "виконати не менше п’яти вимірювань для кожного випадку та подати мінімум, максимум, "
        "середнє й медіану;",
        "дослідити вплив довжини послідовності, розміру навчальної вибірки, ширини вікна K і "
        "кількості епох на час роботи;",
        "побудувати графіки залежності часу від обсягу входу та визначити лінійність чи "
        "нелінійність масштабування;",
        "проаналізувати результати, знайти домінантний параметр і головне вузьке місце, "
        "порівняти висновки з оцінкою складності з другої частини;",
        "запропонувати конкретні оптимізації із зазначенням очікуваного ефекту.",
    ]))
    b(body("Методичні вказівки описують бенчмарк для задачі обробки зображень і пропонують "
           "вимірювати вхідні обсяги 500 КБ, 1 МБ, 5 МБ і 10 МБ, а також роздільність, "
           "кількість пікселів, розмір файлу, формат і кількість каналів. Варіант 6 не працює із "
           "зображеннями: його вхід — це числова послідовність частоти серцевих скорочень. Тому "
           "методику адаптовано явно й без штучного створення файлів: аналогом обсягу входу для "
           "прогнозування є довжина послідовності N (у значеннях BPM), а для навчання й "
           "оцінювання — розмір розміченої вибірки S (у зразках). Штучне масштабування "
           "зображень, підміна форматів і вимірювання роздільності, пікселів, розміру файлу чи "
           "каналів не виконувалися, оскільки для цього варіанта вони не мають змісту."))
    b(body("Вимірювалися п’ять сценаріїв: прогнозування вздовж послідовності (N = 1000, 5000, "
           "25 000, 125 000 і 500 000 значень BPM, K = 4); оцінювання на розміченій вибірці "
           "(S = 1000, 5000, 20 000 і 50 000 зразків); навчання залежно від розміру вибірки (ті "
           "самі S, 20 епох); вплив ширини вікна (K = 4, 8, 16, 32 і 64 за N = 50 000); вплив "
           "кількості епох (E = 10, 25, 50 і 100 за S = 5000). Окремо передбачено сценарій "
           "порівняння навчання у Worker і на головному потоці, який має сенс лише в браузері."))
    b(body("Канонічними для звіту є числа, отримані головним Node-раннером bench/run.js. "
           "Панель «Benchmark» (крок 4) у браузері використовує той самий модуль AIIP.bench і "
           "служить демонстрацією; її абсолютні значення можуть дещо відрізнятися. Сценарій "
           "Worker проти головного потоку в Node пропущено, бо Node не надає Worker у тому "
           "вигляді, у якому його використовує застосунок; вигадані числа для нього не "
           "наводяться."))

    # ------------------------------------------------ 3. Мета
    b(gen.H1("3. Мета роботи"))
    b(body("Дослідити продуктивність застосунку розпізнавання серцевих ритмів: виміряти час "
           "прогнозування, оцінювання та навчання за різних обсягів даних, встановити характер "
           "масштабування та статистичну повторюваність результатів, визначити домінантні "
           "параметри й головне вузьке місце реалізації, а також обґрунтувати напрями "
           "оптимізації з оцінкою їхнього впливу."))

    # ------------------------------------------------ 4. Умови
    b(gen.H1("4. Умови проведення бенчмарку"))
    b(body("Усі канонічні вимірювання виконано на одній машині в один сеанс, без паралельного "
           "навантаження, у режимі CPU-only. JavaScript виконувався в одному потоці; GPU, "
           "WebGL і спеціальні бібліотеки лінійної алгебри не використовувалися. Під час "
           "запуску на машині не було інших обчислювальних процесів, крім одного простоюючого. "
           "Дата запуску — 21.11.2026."))
    b(body("Апаратне та програмне середовище наведено в таблиці 1."))
    b(tcap(1, "Середовище виконання бенчмарку"))
    b(table(
        ["Складова", "Значення"],
        [
            ["Операційна система", "Arch Linux, ядро 7.3.5-arch1-1, архітектура x86_64"],
            ["Процесор", "AMD Ryzen 5 PRO 7540U w/ Radeon 740M Graphics"],
            ["Ядра / потоки", "6 фізичних ядер / 12 логічних потоків"],
            ["Максимальна частота", "4,98 ГГц"],
            ["Кеш-пам’ять", "L1d — 192 КіБ, L2 — 6 МіБ, L3 — 16 МіБ"],
            ["Оперативна пам’ять", "14 ГіБ (15 378 980 864 байт)"],
            ["Node.js", "v22.23.5, рушій V8 12.4.254.21-node.57"],
            ["Браузер (демонстрація)", "Chromium 157.0.8103.79"],
            ["Бібліотека моделі", "brain.js 2.0.0-beta.24"],
            ["Інструменти звіту", "Python 3.14.10, matplotlib 3.11.2, LibreOffice 26.8.3.1"],
            ["Режим вимірювань", "CPU-only, один потік JavaScript, один простоюючий процес"],
            ["Дата", "21.11.2026"],
        ],
        [30, 70], "T1", keep=True))
    b(body("Node-раннер завантажує ті самі модулі, що й застосунок: lib/brain.js і файли з "
           "src/js (util.js, rng.js, generator.js, model.js, bench.js) підключаються через "
           "vm в один спільний контекст. Завдяки цьому вимірюється саме той код, який "
           "виконується в браузері, без переписування алгоритму під Node. Раннер послідовно "
           "проходить усі сценарії, друкує компактну таблицю та зберігає результати у "
           "bench/results.json і bench/results.csv."))
    b(body("Повний канонічний запуск містить 23 випадки та 110 виміряних прогонів (по п’ять на "
           "випадок, ще один прогрівний прогін відкидається) і триває 128,6 с. Браузерний "
           "запуск у Chromium через панель «Benchmark» призначений для демонстрації; він "
           "використовує той самий AIIP.bench, але не є джерелом чисел цього звіту."))

    # ------------------------------------------------ 5. Test data
    b(gen.H1("5. Підготовка тестових даних"))
    b(body("Дані генеруються детерміновано тим самим генератором, що й у попередніх частинах, "
           "із зерном 7. Для кожного з трьох класів генерується однакова кількість прикладів, "
           "тобто класи збалансовані. Кожен приклад — це вікно з K = 4 значень BPM; значення "
           "рівномірно розподілені навколо центру класу з допуском 4 BPM. Діапазони класів: "
           "брадикардія 40–60 BPM, нормальний ритм 60–100 BPM, тахікардія 100–140 BPM. "
           "Тестова частина становить 20 % і відбирається окремо в кожному класі, тому "
           "фактичний розмір вибірки кратний трьом, а не завжди дорівнює замовленому."))
    b(body("Відповідність замовленого та фактичного розмірів вибірки наведено в таблиці 2. "
           "Фактичний розмір виникає тому, що генератор округлює кількість прикладів на клас "
           "угору: наприклад, для 1000 зразків це 334 приклади на клас, разом 1002."))
    b(tcap(2, "Замовлений і фактичний розмір розміченої вибірки"))
    b(table(
        ["Замовлено S", "Фактично S", "На клас", "Train", "Test"],
        [
            ["1000", "1002", "334", "801", "201"],
            ["5000", "5001", "1667", "3999", "1002"],
            ["20 000", "20 001", "6667", "15 999", "4002"],
            ["50 000", "50 001", "16 667", "39 999", "10 002"],
        ],
        [22, 20, 18, 20, 20], "T2", keep=True))
    b(body("Для сценарію прогнозування генеруються детерміновані послідовності BPM довжиною "
           "N = 1000, 5000, 25 000, 125 000 і 500 000 значень із сумішшю всіх трьох класів. "
           "Модель для цього сценарію навчається один раз поза вимірюваним фрагментом. Для "
           "сценарію ширини вікна використовується одна послідовність N = 50 000, а для "
           "кожного K окремо навчається невелика модель на 1000 зразках за 10 епох. Для "
           "сценарію епох використовується вибірка S = 5000 (фактично 5001) і фіксовані "
           "гіперпараметри: hidden = 8, learning rate = 0,3, momentum = 0,1, K = 4."))
    b(body("Генерація набору даних, кодування прикладів і створення моделі в сценаріях "
           "прогнозування та оцінювання виконуються поза таймером. У сценаріях навчання "
           "поза таймером створюється свіжий екземпляр моделі, але кодування вибірки, "
           "побудова мережі, усі епохи та періодичне оцінювання входять у вимірюваний час, "
           "бо саме вони є роботою train. Набори даних для повторних прогонів кешуються, щоб "
           "вимірювати алгоритм, а не генератор."))
    b(body("Жодного штучного збільшення роздільності чи розміру файлу не застосовувалося. "
           "Одиницями обсягу входу є значення BPM для прогнозування та розмічені зразки для "
           "навчання й оцінювання; роздільність, пікселі, канали й формат файлу для цього "
           "варіанта не застосовні."))

    # ------------------------------------------------ 6. Methodology
    b(gen.H1("6. Методика вимірювання"))
    b(body("Час вимірюється монотонним лічильником performance.now() із точністю до часток "
           "мілісекунди. Для кожного випадку виконується один прогрівний прогін, який "
           "відкидається, а потім п’ять виміряних прогонів. Прогрівний прогін потрібен, щоб "
           "прогріти JIT-компілятор V8 і заповнити кеші; він не входить у статистику. Між "
           "випадками та між прогонами раннер віддає керування приблизно на 16 мс, щоб "
           "зменшити вплив безперервного завантаження одного потоку. Штучне очищення сміття "
           "не викликається: збирач сміття V8 працює за власною політикою, і його паузи є "
           "частиною реальної поведінки застосунку."))
    b(body("Межі вимірюваних фрагментів наведено в таблиці 3. У всіх випадках генерація даних "
           "і створення екземпляра моделі виконуються поза таймером; у таймер входить лише "
           "операція, названа в стовпці «Вимірюється»."))
    b(tcap(3, "Межі вимірюваних фрагментів"))
    b(table(
        ["Сценарій", "Що входить у таймер", "Що виключено"],
        [
            ["Прогнозування", "predictSeries: ковзне вікно, кодування, net.run, "
                              "усереднення ймовірностей, масив perWindow",
             "генерація послідовності, навчання моделі, побудова графіків"],
            ["Оцінювання", "evaluate: predictSeries для кожного зразка та обчислення "
                           "accuracy і метрик",
             "генерація й розбиття вибірки, навчання моделі"],
            ["Навчання", "model.train: кодування вибірки, створення мережі, усі епохи, "
                         "періодичне оцінювання точності",
             "генерація вибірки, конструктор RhythmModel, побудова графіків"],
            ["Ширина вікна K", "predictSeries на N = 50 000 для моделі, навченої під це K",
             "навчання моделі для кожного K"],
            ["Кількість епох", "повний model.train із заданою кількістю епох",
             "генерація вибірки, конструктор моделі"],
        ],
        [19, 47, 34], "T3", keep=True))
    b(body("Такий поділ важливий для інтерпретації: число для навчання включає не лише "
           "множення матриць, а й кодування входів у масиви {input, output}, створення "
           "brain.NeuralNetwork і періодичний прогін accuracyOf. Число для прогнозування, "
           "навпаки, не включає навчання, тому його можна порівнювати з часом оцінювання, "
           "поділивши на кількість зразків."))
    b(body("Усі 23 випадки виконуються послідовно, без паралельних потоків і без конкуренції "
           "за процесор. Конвеєр раннера асинхронний лише в тому сенсі, що між випадками "
           "віддає керування циклу подій; самі вимірювані операції синхронні. Повний прогін "
           "триває 128,6 с і не перевищує десятихвилинного ліміту, встановленого для "
           "лабораторного експерименту."))
    b(body("Браузерна демонстрація використовує панель «Benchmark» (крок 4) і той самий "
           "AIIP.bench. У ній доступний додатковий сценарій Worker проти головного потоку: "
           "навчання запускається у Web Worker, а потім примусово на головному потоці через "
           "тимчасове скасування AIIP.trainWorkerMain. У Node цей сценарій пропущено, бо "
           "середовище не надає Worker; тому в звіті для нього наведено лише статус "
           "«пропущено», без чисел."))

    # ------------------------------------------------ 7. Repeatability
    b(gen.H1("7. Повторюваність і статистична обробка"))
    b(body("Для кожного випадку збережено всі п’ять виміряних значень у хронологічному "
           "порядку. Обчислюються мінімум, максимум, середнє, медіана та коефіцієнт варіації "
           "CV = σ/μ, де σ — стандартне відхилення всієї сукупності з п’яти вимірювань (ділення "
           "на n, а не на n − 1). Додатково наведено відношення max/min як просту міру розкиду. "
           "Жодне вимірювання не відкидалося як викид: мета — показати реальну повторюваність, "
           "а не відшліфовану оцінку."))
    b(body("Зведення розкиду за всіма 23 випадками наведено в таблиці 4; самі часи подано в "
           "розділі 9, щоб не дублювати таблиці."))
    b(tcap(4, "Повторюваність вимірювань: коефіцієнт варіації та відношення max/min"))
    rows = []
    groups = [
        ("Прогноз", inf, lambda c: "N = %d" % c["param"]),
        ("Оцінювання", ev, lambda c: "S = %d" % c["param"]),
        ("Навчання", tr, lambda c: "S = %d" % c["param"]),
        ("Ширина K", wk, lambda c: "K = %d" % c["param"]),
        ("Епохи", ep, lambda c: "E = %d" % c["param"]),
    ]
    for gname, cases, label in groups:
        for c in cases:
            rows.append([gname, label(c), num(cv_case(c), 2), num(ratio_case(c), 2),
                         num(max(c["runs"]) - min(c["runs"]), 3)])
    b(table(["Сценарій", "Параметр", "CV, %", "max/min", "Розкид, мс"],
            rows, [18, 20, 14, 14, 24], "T4", keep=False))
    b(body("Для великих обсягів розкид малий: навчання на 5001–50 001 зразку має CV "
           "1,7–2,2 %, епохи — 0,3–2,0 %, прогнозування на 500 000 значень — 2,4 %. Це "
           "означає, що лінійні залежності в розділі 11 не є наслідком шуму. Для малих "
           "обсягів відносний розкид більший: прогнозування на 1000 і 5000 значень дає "
           "CV 9,0 % і 11,3 %, бо абсолютний час 3–19 мс порівнянний із постійними витратами "
           "на виклик, перевірки та планувальник ОС."))
    b(body("Найбільший відносний розкид — 22,5 % — має оцінювання на 1002 зразках. Причина "
           "не в алгоритмі, а в масштабі: середній час становить лише 5,156 мс, тому "
           "коливання JIT, влучання в кеш і пауза збирача сміття дають помітний відсоток. "
           "Абсолютний розкид при цьому малий — від 3,936 до 7,298 мс. На великих вибірках "
           "CV оцінювання знижується до 5,6–8,3 %."))
    b(body("Середнє та медіана в усіх випадках близькі; найбільша відносна різниця — для "
           "оцінювання на 1002 зразках (5,156 проти 4,966 мс, близько 3,8 %), що "
           "підтверджує вплив одного повільного прогону. Відношення max/min лежить у межах "
           "1,01–1,85; для більшості великих випадків воно не перевищує 1,07, тобто "
           "повторюваність добра."))

    # ------------------------------------------------ 8. Parameters
    b(gen.H1("8. Параметри бенчмарку"))
    b(body("Параметри, які змінюються між випадками, зведено в таблиці 5. Решта умов "
           "фіксована: зерно 7, K = 4 (крім сценарію ширини вікна), 20 епох (крім сценарію "
           "епох), hidden = 8, learning rate = 0,3, momentum = 0,1, тестова частка 20 %, "
           "допуск 4 BPM."))
    b(tcap(5, "Параметри бенчмарку та очікуваний вплив"))
    b(table(
        ["Параметр", "Значення", "Роль і очікуваний вплив"],
        [
            ["N — довжина послідовності", "1000–500 000 значень BPM",
             "Кількість вікон K-вікна; час прогнозування має зростати лінійно, O(N·K·H)"],
            ["S — розмір вибірки", "1002–50 001 зразок",
             "Кількість прикладів для навчання й оцінювання; час має зростати лінійно, "
             "O(S·K·H) для оцінювання та O(E·S·K·H) для навчання"],
            ["K — ширина вікна", "4–64 значення",
             "Кількість входів мережі та ширина першої матриці ваг; вплив на множення "
             "лінійний, але на малих K його маскує постійна вартість вікна"],
            ["E — кількість епох", "10–100",
             "Кількість проходів по вибірці; очікується строго лінійне зростання"],
            ["H — прихований шар", "8 нейронів (фіксовано)",
             "Розмір матриць 4×8 і 8×3; зменшення H зменшує кількість множень"],
            ["Тестова частка", "20 % (фіксовано)",
             "Визначає розмір test; впливає на періодичне оцінювання під час навчання"],
            ["Генерація та кеш даних", "поза таймером",
             "Виключає вартість генератора; набори для повторів кешуються"],
            ["Пам’ять і GC", "не керується вручну",
             "Кожне вікно створює тимчасові масиви; на великих N можливі паузи збирача"],
            ["Потоки", "один потік JS",
             "Виключає конкуренцію; Worker у Node недоступний"],
        ],
        [20, 22, 58], "T5", keep=False))
    b(body("Очікувана складність випливає з архітектури мережі 4–8–3. Для одного вікна "
           "прямий прохід виконує K·H множень на першому шарі та H·3 на другому, тобто "
           "O(K·H). Для N вікон прогнозування має бути O(N·K·H), а оскільки K і H фіксовані, "
           "практично O(N). Оцінювання додає прохід по S зразках, тому O(S·K·H), а навчання — "
           "множник E: O(E·S·K·H). Додатково є витрати, яких немає у формулі: створення "
           "масивів на кожне вікно, копіювання підмасивів bpm.slice, виклики net.run і "
           "періодичне обчислення точності. Саме вони можуть зробити сталу складову більшою "
           "за арифметику, тому бенчмарк вимірює реальний час, а не лише кількість множень. "
           "Окремий перебір H у цій роботі не виконувався: H є параметром архітектури, а не "
           "обсягу входу, тому його вплив оцінено за розмірами матриць, а вимірювання винесено "
           "до подальшої роботи."))

    # ------------------------------------------------ 9. Results
    b(gen.H1("9. Результати вимірювань"))
    b(body("Нижче наведено всі п’ять виміряних значень для кожного випадку, а також мінімум, "
           "середнє, медіану й максимум. Одиниця в усіх таблицях — мілісекунди; значення "
           "округлено до 0,001 мс. Це канонічні числа Node-раннера."))

    def result_table(cases, caption, param_head, name):
        rows = []
        for c in cases:
            rows.append([str(c["param"])]
                        + [num(v, 3) for v in c["runs"]]
                        + [num(c["min"], 3), num(c["mean"], 3), num(c["median"], 3),
                           num(c["max"], 3)])
        return (tcap(name, caption),
                table([param_head, "1", "2", "3", "4", "5", "Мін", "Середнє", "Медіана",
                       "Макс"], rows, [16, 9, 9, 9, 9, 9, 10, 11, 10, 10], "T%d" % name,
                      small=True, keep=True))

    t, tab = result_table(inf, "Час прогнозування послідовності (predictSeries), мс",
                          "N, значень", 6)
    b(t)
    b(tab)
    b(body("Час прогнозування зростає від 3,368 мс на 1000 значень до 1827,069 мс на 500 000 "
           "значень, тобто приблизно в 542 рази за збільшення входу в 500 разів. Уже за "
           "цими числами видно близьку до лінійної залежність; точний нахил і R² наведено в "
           "розділі 11."))

    t, tab = result_table(ev, "Час оцінювання розміченої вибірки (evaluate), мс",
                          "S, зразків", 7)
    b(t)
    b(tab)
    b(body("Оцінювання на 1002 зразках триває 5,156 мс у середньому, на 50 001 зразку — "
           "416,457 мс. На відміну від прогнозування, тут на кожен зразок припадає не лише "
           "прямий прохід, а й порівняння з міткою та накопичення метрик."))

    t, tab = result_table(tr, "Час навчання залежно від розміру вибірки (20 епох), мс",
                          "S, зразків", 8)
    b(t)
    b(tab)
    b(body("Навчання — найдорожча операція: 169,929 мс для 1002 зразків і 5710,203 мс для "
           "50 001 зразка. Це час повного model.train, який включає кодування вибірки, "
           "створення мережі, 20 епох і періодичне оцінювання точності."))

    t, tab = result_table(wk, "Час прогнозування залежно від ширини вікна K (N = 50 000), мс",
                          "K, значень", 9)
    b(t)
    b(tab)
    b(body("Залежність від K немонотонна на малих значеннях: K = 8 дає 190,475 мс, що на "
           "4,7 % менше за K = 4 (199,810 мс), а K = 16 і 32 майже однакові (218,640 і "
           "221,945 мс). Лише на K = 64 час помітно зростає до 294,776 мс, тобто на 47,5 % "
           "проти K = 4."))

    t, tab = result_table(ep, "Час навчання залежно від кількості епох (S = 5000), мс",
                          "E, епох", 10)
    b(t)
    b(tab)
    b(body("Час навчання зростає майже строго пропорційно кількості епох: 399,960 мс для "
           "10 епох, 1043,299 мс для 25, 2077,751 мс для 50 і 4152,167 мс для 100. "
           "Відхилення від ідеальної пропорції малі й пояснюються сталою складовою "
           "підготовки."))

    b(body("Сценарій порівняння Worker і головного потоку в Node не виконувався; його статус "
           "наведено в таблиці 11."))
    b(tcap(11, "Статус сценарію Worker проти головного потоку"))
    b(table(
        ["Сценарій", "Статус", "Причина"],
        [
            [str(wr["param"]), "пропущено", str(wr.get("notes", "")).replace("skipped: ", "")
             + "; сценарій доступний у браузерній панелі «Benchmark»"],
        ],
        [18, 18, 64], "T11", keep=True))
    b(body("Повний запуск охоплює 23 випадки та 110 виміряних прогонів; сумарний час "
           "становить 128,6 с. Усі значення скінченні, NaN і від’ємних часів немає."))

    # ------------------------------------------------ 10. Visualization
    b(gen.H1("10. Візуалізація результатів"))
    b(body("На рисунку 1 показано залежність часу прогнозування від довжини послідовності. "
           "Точки — середні значення, відрізки — розмах від мінімуму до максимуму, червона "
           "лінія — лінійна апроксимація. Усі п’ять точок лягають на пряму; видимий невеликий "
           "розмах на кінцях діапазону не змінює характеру залежності."))
    b(image_figure(1, "fig-inference.png", 16.4, 9.24,
                   "Час прогнозування послідовності залежно від її довжини N"))
    b(body("На рисунку 2 ліворуч показано оцінювання, праворуч — навчання. Обидві залежності "
           "лінійні, але нахил навчання значно більший: на 50 001 зразку воно триває "
           "5,71 с проти 0,42 с в оцінювання. Це відповідає 20 епохам і періодичному "
           "обчисленню точності."))
    b(image_figure(2, "fig-eval-train.png", 16.4, 8.72,
                   "Час оцінювання та навчання залежно від розміру вибірки S"))
    b(body("На рисунку 3 ліворуч показано вплив ширини вікна K, праворуч — кількості епох. "
           "Залежність від K майже пласка на 4–32 і зростає на 64; залежність від епох "
           "практично строго лінійна."))
    b(image_figure(3, "fig-k-epochs.png", 16.4, 8.72,
                   "Час прогнозування від K і час навчання від кількості епох"))
    b(body("Додаткові знімки екрана, що підтверджують проведення бенчмарку, наведено на "
           "рисунках 4–7. Вони призначені для заповнення автором після фінального запуску "
           "застосунку."))
    b(shot(4, 6.0, "Панель «Benchmark» (крок 4) після завершення запуску: параметри, "
                   "прогрес і таблиця результатів"))
    b(shot(5, 5.6, "Графік результатів бенчмарку в застосунку: час залежно від обсягу входу"))
    b(shot(6, 5.2, "Вивід Node-раннера bench/run.js у терміналі з підсумковою таблицею"))
    b(shot(7, 4.8, "Збережений файл результатів (JSON або CSV) чи запуск бенчмарку в "
                   "браузері з Worker"))

    # ------------------------------------------------ 11. Analysis
    b(gen.H1("11. Аналіз результатів"))
    b(body("Лінійні апроксимації середніх значень зведено в таблиці 12. Для кожного сценарію "
           "наведено нахил, вільний член і коефіцієнт детермінації R²."))
    b(tcap(12, "Лінійні апроксимації залежностей часу від параметра"))
    b(table(
        ["Сценарій", "Нахил", "Вільний член", "R²"],
        [
            ["Прогнозування", "3,65 мкс на значення", "−0,62 мс", "0,99999"],
            ["Оцінювання", "8,39 мкс на зразок", "−1,66 мс", "0,99986"],
            ["Навчання", "111,4 мкс на зразок", "139,3 мс", "0,99904"],
            ["Ширина вікна K", "1,63 мс на K", "184,78 мс", "0,934"],
            ["Кількість епох", "41,6 мс на епоху", "−6,52 мс", "0,99997"],
        ],
        [26, 26, 24, 24], "T12", keep=True))
    b(body("Прогнозування масштабується лінійно з нахилом 3,65 мкс на одне значення BPM і "
           "R² = 0,99999. Вільний член близький до нуля (формально −0,62 мс, тобто менший за "
           "роздільну здатність вимірювання на малих N), що означає: постійні витрати на "
           "виклик малі порівняно з роботою на кожне вікно. На N = 500 000 середній час "
           "становить 1827,069 мс, або близько 1,83 с. Оскільки вікон майже N, це приблизно "
           "3,65 мкс на одне вікно."))
    b(body("Оцінювання масштабується лінійно з нахилом 8,39 мкс на зразок і R² = 0,99986. "
           "На зразок припадає один виклик predictSeries із чотирма значеннями, тому "
           "очікувалося близько 3,65 мкс; фактичні 8,39 мкс у 2,3 раза більші. Причини — "
           "цикл по зразках, порівняння з міткою, накопичення метрик і гірша локальність "
           "кешу на великих вибірках. Перша точка цього сценарію (1002 зразки) дає лише "
           "5,15 мкс на зразок: 1002 вікна по чотири числа — це близько 32 КБ, що вміщується "
           "в L1d (192 КіБ), тоді як 50 001 зразок уже не вміщується в кеш і частіше звертається "
           "до L2/L3 та пам’яті. Тому перша точка не є викидом, а відображає локальність "
           "даних."))
    b(body("Навчання описується прямою 111,4 мкс на зразок вибірки плюс 139,3 мс сталої "
           "складової з R² = 0,99904. Тут S — повний розмір вибірки, а навчається 80 % її "
           "зразків протягом 20 епох; у перерахунку на один зразок вибірки за одну епоху це "
           "близько 5,6 мкс. Стала складова 139,3 мс — це кодування вибірки у формат {input, output}, "
           "створення brain.NeuralNetwork і початкові витрати; вона помітна на малих S і "
           "майже губиться на 50 001 зразку (5710,203 мс)."))
    b(body("Кількість епох дає строго лінійну залежність: 41,6 мс на епоху з R² = 0,99997. "
           "На S = 5001 (3999 навчальних зразків) одна епоха коштує близько 41,6 мс, а "
           "100 епох — 4152,167 мс. Це підтверджує, що цикл навчання не має прихованої "
           "квадратичної складової: час визначається кількістю проходів по вибірці."))
    b(body("Ширина вікна K — найцікавіший сценарій. Формальна апроксимація дає 1,63 мс на K "
           "з R² = 0,934, але точки 4–32 утворюють майже плато: 199,810; 190,475; 218,640; "
           "221,945 мс. Лише K = 64 дає 294,776 мс, тобто +47,5 % проти K = 4. Це означає, що "
           "на малих K час визначається не множенням матриць, а сталою вартістю обробки "
           "кожного вікна (створення підмасиву, кодування, виклик net.run, об’єкт "
           "результату). На K = 64 перша матриця ваг стає 64×8, і арифметика починає помітно "
           "додаватися до цієї сталої. Аномалія K = 8 < K = 4 на 4,7 % лежить поблизу межі "
           "розкиду (CV 1,7–3,2 %) і найімовірніше пов’язана з різними моделями, навченими "
           "окремо для кожного K, вирівнюванням даних у кеші та варіацією JIT, а не з "
           "фізичним прискоренням від ширшого вікна."))
    b(body("Домінантний параметр залежить від операції. Для прогнозування це N: збільшення "
           "послідовності в 500 разів збільшує час у 542 рази, тоді як K на порядок менший "
           "за N і на малих значеннях майже не впливає. Для навчання домінують S та E: "
           "50 001 зразок проти 1002 дає 33,6 раза, а 100 епох проти 10 — 10,4 раза. "
           "Прихований шар H фіксований на 8, тому його внесок у цьому експерименті не "
           "варіювався, але за архітектурою він лінійно множить обидва шари."))
    b(body("Головне вузьке місце прогнозування — функція predictSeries у src/js/model.js "
           "(приблизно рядок 132). На кожне вікно вона виконує bpm.slice(i, i + k), потім "
           "bpm.map((v) => this.encode(v)), потім net.run, після чого створює об’єкт "
           "результату й додає його в масив perWindow. Для N = 500 000 це 499 997 вікон, "
           "тобто близько мільйона тимчасових масивів і 500 000 збережених об’єктів. Сам "
           "net.run додатково виділяє матриці та масиви на кожен виклик. Саме тому на "
           "вікно витрачається 3,65 мкс, хоча арифметики там лише 4·8 + 8·3 = 56 множень: "
           "час іде на виділення пам’яті, копіювання та збирач сміття, а не на множення."))
    b(body("У навчанні вузьке місце інше: trainChunked (приблизно рядок 276) викликає "
           "net.train(rows, {iterations: 1, ...}) один раз на епоху. Кожен виклик — це "
           "перехід через межу JS-коду бібліотеки, перевірки та підготовка, які повторюються "
           "E разів. Додатково кожні evalEvery епох (для E ≤ 100 це кожна епоха) виконується "
           "accuracyOf по train і test, що додає прохід net.run по тисячах рядків. Стала "
           "139,3 мс і помітний нахил на епоху — наслідок саме цієї організації, а не "
           "неефективних множень."))
    b(body("Порівняно з другою частиною, де складність була оцінена як O(N·K) для "
           "прогнозування та O(E·S·K·H) для навчання, вимірювання підтверджують ці оцінки: "
           "обидві залежності лінійні з R², близькими до одиниці, а K поводиться сублінійно "
           "лише тому, що стала складова переважає на малих значеннях. Оцінка «десятки "
           "мікросекунд на вікно» з другої частини виявилася навіть завищеною для K = 4: "
           "фактично близько 3,65 мкс на вікно. Отже, архітектурна модель складності була правильною, "
           "але вона не описувала постійних витрат на виділення пам’яті, які й визначають "
           "реальну продуктивність на великих N."))

    # ------------------------------------------------ 12. Improvements
    b(gen.H1("12. Покращення продуктивності"))
    b(body("Оптимізації нижче поділено на дві групи: усунення зайвих виділень пам’яті в "
           "прогнозуванні та зменшення накладних витрат у навчанні. Усі відсотки є оцінками, "
           "а не виміряними результатами; вони вказують порядок очікуваного ефекту."))
    b(tcap(13, "Запропоновані оптимізації та очікуваний ефект"))
    b(table(
        ["Оптимізація", "Конкретна зміна", "Очікуваний ефект (оцінка)"],
        [
            ["Попереднє кодування всієї послідовності",
             "Один раз перетворити N значень BPM у Float32Array; у циклі брати "
             "subarray-подання без bpm.slice і bpm.map; кешувати buffer і повторно "
             "використовувати його",
             "20–40 % швидше прогнозування; менше тимчасових масивів і пауз GC"],
            ["Відмова від об’єктів на кожне вікно",
             "Не створювати об’єкт результату для кожного вікна; накопичувати суми "
             "ймовірностей безпосередньо; зробити perWindow необов’язковим або потоковим",
             "Пам’ять O(1) замість O(N); на N = 500 000 зникає близько 500 000 об’єктів "
             "і пов’язаний з ними GC"],
            ["Пакетний прямий прохід",
             "Обробляти W вікон за один виклик; замінити net.run на власне множення "
             "типізованих масивів із заздалегідь виділеними буферами",
             "2–4× швидше прогнозування (оцінка); найбільший виграш на великих N"],
            ["WebGL / WASM / GPU",
             "Винести множення матриць у WebGL-шейдер або WASM-модуль для N ≥ 100 000",
             "Потенційно на порядок швидше на дуже великих N (оцінка); на малих N "
             "перевагу з’їдає накладний час передачі даних"],
            ["Менший прихований шар",
             "Зменшити H з 8 до 5–6 і перенавчити модель з перевіркою accuracy та macro-F1",
             "На 25–37 % менше множень у першому шарі (оцінка); можливе невелике "
             "просідання точності, потрібна валідація"],
            ["Більше iterations за виклик net.train",
             "Замість 20 викликів з iterations = 1 робити, наприклад, 4 виклики по 5 "
             "ітерацій; зберегти history і періодичне оцінювання",
             "5–15 % швидше навчання (оцінка) за рахунок меншої кількості переходів "
             "через межу JS-бібліотеки"],
            ["Рідше оцінювання та рання зупинка",
             "Оцінювати точність не щоепохи, а кожні 5–10 епох; увімкнути errorThresh "
             "для дострокового завершення",
             "До 10–20 % на малих S (оцінка); крива точності стає грубшою"],
            ["Worker і передавання буферів",
             "Залишити навчання у Worker; для прогнозування великих серій передавати "
             "Float32Array через transferable; не копіювати ваги через JSON",
             "Не прискорює саму операцію, але звільняє головний потік і усуває "
             "копіювання великих масивів"],
        ],
        [20, 44, 36], "T13", keep=False))
    b(body("Найбільший сумарний ефект дають дві зміни. Перша — пакетний прямий прохід на "
           "типізованих масивах із попереднім кодуванням послідовності: вона прибирає "
           "bpm.slice, bpm.map, об’єкти на вікно та повторне виділення матриць, тобто "
           "атакує саме те, що домінує в predictSeries. Друга — менша кількість викликів "
           "net.train із більшим iterations: вона зменшує постійні витрати, які зараз "
           "повторюються на кожній епосі. Зменшення H і рідше оцінювання дають помірний "
           "додатковий виграш, але вимагають перевірки якості моделі."))
    b(body("Оптимізації слід впроваджувати поетапно й вимірювати тим самим раннером, щоб "
           "не обміняти швидкість на непомітне погіршення точності. Найбезпечніший перший "
           "крок — прибрати perWindow і зайві копії, не змінюючи математику мережі; він не "
           "впливає на результат класифікації взагалі."))

    # ------------------------------------------------ 13. Conclusion
    b(gen.H1("13. Висновок"))
    b(body("У третій частині лабораторної роботи виміряно продуктивність застосунку "
           "розпізнавання серцевих ритмів варіанта 6. Методику адаптовано до задачі без "
           "зображень: замість розмірів файлів і роздільності досліджено довжину "
           "послідовності N і розмір розміченої вибірки S. Вимірювання виконано в Node.js "
           "на одному потоці, по п’ять прогонів на випадок, з одним відкинутим прогрівним "
           "прогоном; усього 23 випадки, 110 прогонів і 128,6 с."))
    b(body("Отримані залежності лінійні. Прогнозування зростає з нахилом 3,65 мкс на "
           "значення BPM (R² = 0,99999) і сягає 1,83 с на 500 000 значень. Навчання "
           "зростає з нахилом 111,4 мкс на зразок плюс 139,3 мс (R² = 0,99904) і триває "
           "5,71 с на 50 001 зразку за 20 епох. Кількість епох дає 41,6 мс на епоху "
           "(R² = 0,99997), тому 100 епох — це 4,15 с. Ширина вікна впливає слабо до K = 32 "
           "і дає +47,5 % на K = 64."))
    b(body("Домінантний параметр для прогнозування — довжина послідовності N, для "
           "навчання — розмір вибірки S та кількість епох E. Головне вузьке місце — не "
           "множення матриць, а організація циклу в predictSeries: bpm.slice, bpm.map, "
           "net.run і об’єкт на кожне вікно, а також збереження perWindow. У навчанні "
           "додаткові витрати створює виклик net.train з iterations = 1 на кожну епоху та "
           "періодичне оцінювання точності."))
    b(body("Оцінка складності з другої частини підтверджена: O(N·K) для прогнозування та "
           "O(E·S·K·H) для навчання описують дані з високим R². Розбіжність лише в тому, "
           "що реальний час визначають сталі витрати на пам’ять і переходи між JS-кодом і "
           "бібліотекою, а не сама арифметика. Найбільший очікуваний ефект дадуть пакетний "
           "прямий прохід на типізованих масивах із попереднім кодуванням і менша кількість "
           "викликів net.train; це напрями подальшої оптимізації застосунку."))
    b(P("BodyFirst", "Вихідний код застосунку доступний у репозиторії:"))
    b(PX("BodyCenter", gen.A("https://github.com/danylo-volchenko/poly-aiip",
                             "https://github.com/danylo-volchenko/poly-aiip")))

    return "".join(out)


# --------------------------------------------------------------- build
IMAGES = [
    ("Pictures/fig-inference.png", "fig-inference.png"),
    ("Pictures/fig-eval-train.png", "fig-eval-train.png"),
    ("Pictures/fig-k-epochs.png", "fig-k-epochs.png"),
]

HEADER_PAGE_STYLE = (
    '<style:style style:name="HeaderPageNum" style:family="paragraph" '
    'style:parent-style-name="Standard">'
    '<style:paragraph-properties fo:text-align="right" fo:line-height="100%" '
    'style:justify-single-word="false"/>'
    '<style:text-properties style:font-name="Times New Roman" fo:font-size="12pt" '
    'style:font-size-asian="12pt" style:font-size-complex="12pt"/></style:style>')

MASTER_STANDARD = (
    '<style:master-page style:name="Standard" style:page-layout-name="Mpm1" '
    'draw:style-name="Mdp1"><style:header><text:p text:style-name="HeaderPageNum">'
    '<text:page-number text:select-page="current">3</text:page-number>'
    '</text:p></style:header></style:master-page>')


def make_styles():
    s = gen.make_styles()
    s = s.replace("</office:styles>", HEADER_PAGE_STYLE + "</office:styles>", 1)
    s = s.replace(
        '<style:master-page style:name="Standard" style:page-layout-name="Mpm1" draw:style-name="Mdp1"/>',
        MASTER_STANDARD, 1)
    s = s.replace(
        '<style:master-page style:name="Index" style:page-layout-name="Mpm1" draw:style-name="Mdp1"/>',
        '<style:master-page style:name="Index" style:page-layout-name="Mpm1" '
        'draw:style-name="Mdp1" style:next-style-name="Standard"/>', 1)
    s = s.replace(
        'style:name="First_20_Page" style:display-name="First Page" '
        'style:page-layout-name="Mpm1" draw:style-name="Mdp1" style:next-style-name="Standard"',
        'style:name="First_20_Page" style:display-name="First Page" '
        'style:page-layout-name="Mpm1" draw:style-name="Mdp1" style:next-style-name="Index"', 1)
    s = re.sub(
        r'(<style:page-layout style:name="Mpm1">.*?)(<style:header-style/>)',
        r'\1<style:header-style><style:header-footer-properties fo:min-height="0.7cm" '
        r'fo:margin-bottom="0.1cm"/></style:header-style>',
        s, count=1, flags=re.S)
    return s


MANIFEST = ('<?xml version="1.0" encoding="UTF-8"?>\n'
            '<manifest:manifest xmlns:manifest="urn:oasis:names:tc:opendocument:xmlns:manifest:1.0" '
            'manifest:version="1.4">'
            '<manifest:file-entry manifest:full-path="/" manifest:version="1.4" '
            'manifest:media-type="application/vnd.oasis.opendocument.text"/>'
            '<manifest:file-entry manifest:full-path="content.xml" manifest:media-type="text/xml"/>'
            '<manifest:file-entry manifest:full-path="styles.xml" manifest:media-type="text/xml"/>'
            '<manifest:file-entry manifest:full-path="meta.xml" manifest:media-type="text/xml"/>'
            '<manifest:file-entry manifest:full-path="settings.xml" manifest:media-type="text/xml"/>'
            + "".join('<manifest:file-entry manifest:full-path="%s" manifest:media-type="image/png"/>'
                      % arc for arc, _ in IMAGES)
            + '</manifest:manifest>')


def make_content(pages):
    """Build the body before serialising automatic styles: table column styles
    are registered while the body is built."""
    prefix = gen.load_prefix()
    seq = ('<text:sequence-decls><text:sequence-decl text:display-outline-level="0" '
           'text:name="Illustration"/><text:sequence-decl text:display-outline-level="0" '
           'text:name="Table"/><text:sequence-decl text:display-outline-level="0" '
           'text:name="Text"/><text:sequence-decl text:display-outline-level="0" '
           'text:name="Drawing"/><text:sequence-decl text:display-outline-level="0" '
           'text:name="Figure"/></text:sequence-decls>')
    body_xml = build_body(pages)
    return (prefix
            + "<office:automatic-styles>" + "".join(gen.STYLES) + "</office:automatic-styles>"
            + '<office:body><office:text text:use-soft-page-breaks="true">'
            + seq + body_xml
            + "</office:text></office:body></office:document-content>")


def package(content_xml, path):
    with zipfile.ZipFile(path, "w") as z:
        z.writestr(zipfile.ZipInfo("mimetype"),
                   "application/vnd.oasis.opendocument.text",
                   compress_type=zipfile.ZIP_STORED)
        z.writestr("META-INF/manifest.xml", MANIFEST, zipfile.ZIP_DEFLATED)
        z.writestr("content.xml", content_xml, zipfile.ZIP_DEFLATED)
        z.writestr("styles.xml", make_styles(), zipfile.ZIP_DEFLATED)
        z.writestr("meta.xml", gen.make_meta(), zipfile.ZIP_DEFLATED)
        z.writestr("settings.xml",
                   open(os.path.join(gen.TEMPLATE_DIR, "settings.xml"), encoding="utf-8").read(),
                   zipfile.ZIP_DEFLATED)
        for arc, src in IMAGES:
            with open(os.path.join(FIG_DIR, src), "rb") as fh:
                z.writestr(arc, fh.read(), zipfile.ZIP_DEFLATED)


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
    gen.package = package
    gen.build(pages, OUT_ODT)
    print("wrote", OUT_ODT, os.path.getsize(OUT_ODT), "bytes;",
          "pages known:", len(pages))


if __name__ == "__main__":
    main()
