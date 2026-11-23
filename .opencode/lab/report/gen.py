#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Generate the AIIP Lab-1 Part-1 report as a valid ODT from the template styles."""
import os, re, shutil, zipfile

BASE = os.path.dirname(os.path.abspath(__file__))
BUILD = os.environ.get("LAB_BUILD_DIR", BASE)
TEMPLATE_DIR = os.environ.get("LAB_TEMPLATE_DIR", os.path.join(BASE, "template"))
OUT_ODT = os.environ.get("LAB_OUT_ODT", os.path.join(BUILD, "report.odt"))
PAGE_W = "21cm"
PAGE_H = "29.7cm"
TEXT_W_CM = 17.0
FIG_W = "16.4cm"

# ---------------------------------------------------------------- helpers
def esc(s):
    return (s.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;"))

STYLES = []      # automatic style definitions
def st(s):
    STYLES.append(s)

def P(style, text=""):
    if text == "":
        return f'<text:p text:style-name="{style}"/>'
    return f'<text:p text:style-name="{style}">{esc(text)}</text:p>'

def PX(style, inner):
    return f'<text:p text:style-name="{style}">{inner}</text:p>'

def A(url, label):
    return f'<text:a xlink:type="simple" xlink:href="{esc(url)}">{esc(label)}</text:a>'

def H(level, text, style):
    return f'<text:h text:style-name="{style}" text:outline-level="{level}">{esc(text)}</text:h>'

def H1(t):
    return H(1, re.sub(r"^(\d+)\. ", r"\1. ", t), "H1")

def H2(t):
    return H(2, re.sub(r"^(\d+\.\d+) ", r"\1. ", t), "H2")

def ul(items):
    inner = "".join(f'<text:list-item>{P("ListItem", it)}</text:list-item>' for it in items)
    return f'<text:list text:style-name="LBullet">{inner}</text:list>'

def ol(items):
    inner = "".join(f'<text:list-item>{P("ListItem", it)}</text:list-item>' for it in items)
    return f'<text:list text:style-name="LNum">{inner}</text:list>'

_col = [0]
def table(headers, rows, widths, name="Tbl"):
    """widths: list of relative weights."""
    global _col
    tname = name
    total = sum(widths)
    coldefs = []
    cells_head = []
    for i, w in enumerate(widths):
        cm = round(TEXT_W_CM * w / total, 3)
        cs = f"TCol_{tname}_{i}"
        st(f'<style:style style:name="{cs}" style:family="table-column">'
           f'<style:table-column-properties style:column-width="{cm}cm"/></style:style>')
        coldefs.append(f'<table:table-column table:style-name="{cs}"/>')
        cells_head.append(f'<table:table-cell table:style-name="TCellHead">'
                          f'{P("TableHead", headers[i])}</table:table-cell>')
    header_row = ("<table:table-header-rows><table:table-row>"
                  + "".join(cells_head) + "</table:table-row></table:table-header-rows>")
    body_rows = []
    for r in rows:
        tds = "".join(f'<table:table-cell table:style-name="TCell">{P("TableCell", str(c))}</table:table-cell>'
                      for c in r)
        body_rows.append(f'<table:table-row>{tds}</table:table-row>')
    return (f'<table:table table:name="{tname}" table:style-name="TblStyle">'
            + "".join(coldefs) + header_row + "".join(body_rows) + "</table:table>")

def caption(n, text):
    return P("Caption", f"Рисунок {n} - {text}")

def figure(n, height_cm, cap_text):
    frame = (f'<draw:frame draw:name="Рисунок{n}" text:anchor-type="as-char" '
             f'svg:width="{FIG_W}" svg:height="{height_cm}cm" draw:style-name="PHFrame">'
             f'<draw:text-box>{P("PHText", "[МІСЦЕ ДЛЯ СКРІНШОТА]")}</draw:text-box></draw:frame>')
    return PX("BodyCenter", frame) + caption(n, cap_text)

def pagebreak():
    return P("PageBreak")

BODY = []
def B(*chunks):
    for c in chunks:
        BODY.append(c)

# ---------------------------------------------------------------- styles
st('<style:style style:name="TitleLine" style:family="paragraph" style:parent-style-name="Standard">'
   '<style:paragraph-properties fo:text-align="center" fo:line-height="150%" style:justify-single-word="false"/>'
   '<style:text-properties style:font-name="Times New Roman" fo:font-size="12pt" style:font-size-asian="12pt" style:font-size-complex="12pt"/></style:style>')
st('<style:style style:name="TitleBig" style:family="paragraph" style:parent-style-name="Standard">'
   '<style:paragraph-properties fo:text-align="center" fo:line-height="150%" style:justify-single-word="false"/>'
   '<style:text-properties style:font-name="Times New Roman" fo:font-size="14pt" style:font-size-asian="14pt" style:font-size-complex="14pt"/></style:style>')
st('<style:style style:name="TitleTopic" style:family="paragraph" style:parent-style-name="Standard">'
   '<style:paragraph-properties fo:text-align="center" fo:line-height="150%" style:justify-single-word="false"/>'
   '<style:text-properties style:font-name="Times New Roman" fo:font-size="13pt" fo:font-weight="bold" style:font-size-asian="13pt" style:font-size-complex="13pt" style:font-weight-asian="bold" style:font-weight-complex="bold"/></style:style>')
st('<style:style style:name="TitleRight" style:family="paragraph" style:parent-style-name="Standard">'
   '<style:paragraph-properties fo:text-align="right" fo:line-height="150%" style:justify-single-word="false"/>'
   '<style:text-properties style:font-name="Times New Roman" fo:font-size="12pt" style:font-size-asian="12pt" style:font-size-complex="12pt"/></style:style>')

st('<style:style style:name="H1" style:family="paragraph" style:parent-style-name="Heading">'
   '<style:paragraph-properties fo:text-align="left" fo:line-height="150%" fo:margin-top="0.4cm" fo:margin-bottom="0.2cm" fo:keep-with-next="always" style:justify-single-word="false"/>'
   '<style:text-properties style:font-name="Times New Roman" fo:font-size="14pt" fo:font-weight="bold" style:font-size-asian="14pt" style:font-size-complex="14pt" style:font-weight-asian="bold" style:font-weight-complex="bold"/></style:style>')
st('<style:style style:name="H2" style:family="paragraph" style:parent-style-name="Heading">'
   '<style:paragraph-properties fo:text-align="left" fo:line-height="150%" fo:margin-top="0.3cm" fo:margin-bottom="0.15cm" fo:keep-with-next="always" style:justify-single-word="false"/>'
   '<style:text-properties style:font-name="Times New Roman" fo:font-size="13pt" fo:font-weight="bold" style:font-size-asian="13pt" style:font-size-complex="13pt" style:font-weight-asian="bold" style:font-weight-complex="bold"/></style:style>')

st('<style:style style:name="Body" style:family="paragraph" style:parent-style-name="Standard">'
   '<style:paragraph-properties fo:text-align="justify" fo:line-height="150%" fo:text-indent="1.25cm" style:justify-single-word="false" style:writing-mode="lr-tb"/>'
   '<style:text-properties style:font-name="Times New Roman" fo:font-size="12pt" style:font-size-asian="12pt" style:font-size-complex="12pt"/></style:style>')
st('<style:style style:name="BodyFirst" style:family="paragraph" style:parent-style-name="Standard">'
   '<style:paragraph-properties fo:text-align="justify" fo:line-height="150%" fo:text-indent="0cm" style:justify-single-word="false" style:writing-mode="lr-tb"/>'
   '<style:text-properties style:font-name="Times New Roman" fo:font-size="12pt" style:font-size-asian="12pt" style:font-size-complex="12pt"/></style:style>')
st('<style:style style:name="BodyCenter" style:family="paragraph" style:parent-style-name="Standard">'
   '<style:paragraph-properties fo:text-align="center" fo:line-height="100%" style:justify-single-word="false"/>'
   '<style:text-properties style:font-name="Times New Roman" fo:font-size="12pt" style:font-size-asian="12pt" style:font-size-complex="12pt"/></style:style>')

st('<style:style style:name="ListItem" style:family="paragraph" style:parent-style-name="Standard">'
   '<style:paragraph-properties fo:text-align="justify" fo:line-height="150%" fo:margin-left="0.75cm" fo:margin-bottom="0cm" style:justify-single-word="false"/>'
   '<style:text-properties style:font-name="Times New Roman" fo:font-size="12pt" style:font-size-asian="12pt" style:font-size-complex="12pt"/></style:style>')

st('<style:style style:name="Caption" style:family="paragraph" style:parent-style-name="Standard">'
   '<style:paragraph-properties fo:text-align="center" fo:line-height="120%" fo:margin-top="0.1cm" fo:margin-bottom="0.35cm" style:justify-single-word="false"/>'
   '<style:text-properties style:font-name="Times New Roman" fo:font-size="11pt" style:font-size-asian="11pt" style:font-size-complex="11pt"/></style:style>')

st('<style:style style:name="TableHead" style:family="paragraph" style:parent-style-name="Standard">'
   '<style:paragraph-properties fo:text-align="center" fo:line-height="115%" style:justify-single-word="false"/>'
   '<style:text-properties style:font-name="Times New Roman" fo:font-size="11pt" fo:font-weight="bold" style:font-size-asian="11pt" style:font-size-complex="11pt" style:font-weight-asian="bold" style:font-weight-complex="bold"/></style:style>')
st('<style:style style:name="TableCell" style:family="paragraph" style:parent-style-name="Standard">'
   '<style:paragraph-properties fo:text-align="left" fo:line-height="115%" style:justify-single-word="false"/>'
   '<style:text-properties style:font-name="Times New Roman" fo:font-size="11pt" style:font-size-asian="11pt" style:font-size-complex="11pt"/></style:style>')
st('<style:style style:name="PHText" style:family="paragraph" style:parent-style-name="Standard">'
   '<style:paragraph-properties fo:text-align="center" fo:line-height="115%" fo:padding-top="0.15cm" style:justify-single-word="false"/>'
   '<style:text-properties style:font-name="Times New Roman" fo:font-size="11pt" fo:color="#808080" style:font-size-asian="11pt" style:font-size-complex="11pt"/></style:style>')

st('<style:style style:name="PageBreak" style:family="paragraph" style:parent-style-name="Standard">'
   '<style:paragraph-properties fo:break-before="page"/></style:style>')

st('<style:style style:name="TocTitle" style:family="paragraph" style:parent-style-name="Standard">'
   '<style:paragraph-properties fo:text-align="center" fo:line-height="150%" fo:margin-bottom="0.4cm" style:justify-single-word="false"/>'
   '<style:text-properties style:font-name="Times New Roman" fo:font-size="14pt" fo:font-weight="bold" style:font-size-asian="14pt" style:font-size-complex="14pt" style:font-weight-asian="bold" style:font-weight-complex="bold"/></style:style>')
st('<style:style style:name="TocEntry" style:family="paragraph" style:parent-style-name="Standard">'
   '<style:paragraph-properties fo:line-height="150%" style:justify-single-word="false">'
   '<style:tab-stops><style:tab-stop style:position="16.7cm" style:type="right" style:leader-style="dotted" style:leader-text="."/></style:tab-stops>'
   '</style:paragraph-properties>'
   '<style:text-properties style:font-name="Times New Roman" fo:font-size="12pt" style:font-size-asian="12pt" style:font-size-complex="12pt"/></style:style>')
st('<style:style style:name="TocEntry2" style:family="paragraph" style:parent-style-name="Standard">'
   '<style:paragraph-properties fo:line-height="150%" fo:margin-left="0.75cm" style:justify-single-word="false">'
   '<style:tab-stops><style:tab-stop style:position="16.7cm" style:type="right" style:leader-style="dotted" style:leader-text="."/></style:tab-stops>'
   '</style:paragraph-properties>'
   '<style:text-properties style:font-name="Times New Roman" fo:font-size="12pt" style:font-size-asian="12pt" style:font-size-complex="12pt"/></style:style>')

# list styles
st('<text:list-style style:name="LBullet">'
   '<text:list-level-style-bullet text:level="1" text:bullet-char="\u2022">'
   '<style:list-level-properties text:space-before="0.75cm" text:min-label-width="0.4cm"/></text:list-level-style-bullet></text:list-style>')
st('<text:list-style style:name="LNum">'
   '<text:list-level-style-number text:level="1" style:num-format="1" style:num-suffix=".">'
   '<style:list-level-properties text:space-before="0.75cm" text:min-label-width="0.5cm"/></text:list-level-style-number></text:list-style>')

# table styles
st('<style:style style:name="TblStyle" style:family="table">'
   '<style:table-properties style:width="' + str(TEXT_W_CM) + 'cm" table:align="center" fo:margin-top="0.15cm" fo:margin-bottom="0.35cm"/></style:style>')
st('<style:style style:name="TCellHead" style:family="table-cell">'
   '<style:table-cell-properties fo:padding="0.1cm" fo:border="0.5pt solid #000000" fo:background-color="#e8e8e8" style:vertical-align="middle"/></style:style>')
st('<style:style style:name="TCell" style:family="table-cell">'
   '<style:table-cell-properties fo:padding="0.1cm" fo:border="0.5pt solid #000000" style:vertical-align="top"/></style:style>')

# figure frame style
st('<style:style style:name="PHFrame" style:family="graphic" style:parent-style-name="Graphics">'
   '<style:graphic-properties draw:stroke="dash" svg:stroke-width="0.03cm" svg:stroke-color="#9a9a9a" draw:fill="none" draw:fill-color="#ffffff" fo:padding="0cm"/>'
   '</style:style>')

TOC_ITEMS = [
    (1, "1. Тема"),
    (1, "2. Постановка завдання"),
    (1, "3. Мета роботи"),
    (1, "4. Загальний опис застосунку"),
    (1, "5. Інтерфейс застосунку та обґрунтування рішень"),
    (2, "5.1. Компонування вікна"),
    (2, "5.2. Захист від неправильної послідовності дій"),
    (2, "5.3. Перевірка введених даних"),
    (2, "5.4. Індикатори прогресу"),
    (2, "5.5. Заповнювачі (placeholders)"),
    (2, "5.6. Іконка «Інформація»"),
    (2, "5.7. Збереження результатів"),
    (2, "5.8. Кольори, доступність, адаптивність"),
    (2, "5.9. Інші рішення, ухвалені під час проєктування"),
    (1, "6. Сценарії використання"),
    (1, "7. Опис елементів інтерфейсу"),
    (1, "8. Зміни інтерфейсу під час розробки"),
    (1, "9. Можливі покращення"),
    (1, "10. Висновок"),
]

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
    b(P("TitleBig", "Звіт до лабораторної роботи №1"))
    b(P("TitleLine", "З дисципліни: «Опрацювання зображень методами штучного інтелекту»"))
    b(P("TitleTopic", "на тему: «Розпізнавання серцевих ритмів за допомогою нейронної мережі. Частина 1. Інтерфейс»"))
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
        b(PX(style, esc(text) + "<text:tab/>" + str(pg)))
    b(pagebreak())

    # ------------------------------------------------ 1. Тема
    b(H1("1. Тема"))
    b(P("Body", "Розпізнавання серцевих ритмів (нормальний синусовий ритм, тахікардія, брадикардія) за допомогою нейронної мережі. Частина 1. Інтерфейс."))
    b(P("Body", "Темою роботи є проєктування та реалізація графічного інтерфейсу користувача для застосунку, який генерує синтетичні послідовності серцевих ритмів, готує на їх основі набір даних, навчає класифікатор і розпізнає послідовності, введені користувачем."))

    # ------------------------------------------------ 2. Постановка завдання
    b(H1("2. Постановка завдання"))
    b(P("Body", "Варіант 6: згенерувати послідовності по 4 числа, що відображають:"))
    b(ol([
        "ритми нормального серця;",
        "ритми серця швидкого (тахікардія);",
        "ритми серця повільного (брадикардія).",
    ]))
    b(P("Body", "Ними навчити просту мережу і розпізнавати послідовності на вході. Кількість даних можна обмежити."))
    b(P("Body", "Додатково до варіанта, у межах першої частини роботи необхідно спроєктувати та реалізувати графічний інтерфейс користувача (GUI) вебзастосунку. Вимоги до інтерфейсу, сформульовані на основі методичних вказівок та зауважень викладача:"))
    b(ul([
        "застосунок має бути реалізований засобами HTML5, CSS3 та JavaScript і працювати локально, без серверної частини та без етапу збирання;",
        "для генерації прикладів використовується формула з методичних вказівок; кількість елементів у послідовності (K) має бути налаштовуваною;",
        "підтримуються три класи ритмів: нормальний (60–100 BPM), тахікардія (100–140 BPM), брадикардія (40–60 BPM);",
        "кількість прикладів на клас має бути налаштовуваною; рекомендовано щонайменше 250 прикладів;",
        "мають бути передбачені поля для кількості епох навчання та швидкості навчання (швидкість навчання стає активною після інтеграції Brain.js у другій частині роботи);",
        "операції генерації, навчання та розпізнавання мають супроводжуватися реальним індикатором прогресу;",
        "усі операції мають журналюватися, а журнал — зберігатися у файл;",
        "результати мають зберігатися у трьох графічних форматах (PNG, JPG, BMP), а також у текстовому вигляді;",
        "порожні області мають містити текстові заповнювачі (placeholders);",
        "елементи керування мають бути зрозуміло названі; має бути іконка «Інформація» з технічними деталями.",
    ]))

    # ------------------------------------------------ 3. Мета роботи
    b(H1("3. Мета роботи"))
    b(P("Body", "Розробити зручний та стійкий до помилок користувача графічний інтерфейс вебзастосунку для генерації набору даних серцевих ритмів, навчання класифікатора та розпізнавання введених послідовностей, а також обґрунтувати ухвалені під час проєктування рішення."))

    # ------------------------------------------------ 4. Загальний опис
    b(H1("4. Загальний опис застосунку"))
    b(P("Body", "Застосунок «AIIP — Heart Rhythm Classifier» реалізовано як односторінковий клієнтський застосунок (single-page application) на HTML5, CSS3 та чистому JavaScript без зовнішніх бібліотек, без серверної частини та без етапу збирання. Для запуску достатньо відкрити файл src/index.html у сучасному браузері (або виконати сценарій ./start.sh, який лише запускає локальний статичний сервер)."))
    b(P("Body", "Класи ритмів, що підтримуються (Варіант 6): брадикардія (Bradycardia, 40–60 BPM), нормальний синусовий ритм (Normal, 60–100 BPM) та тахікардія (Tachycardia, 100–140 BPM)."))
    b(P("Body", "Робочий процес організовано у три послідовні кроки, які відображаються трьома картками на головній сторінці: «Generate dataset» — генерація синтетичного набору даних; «Train model» — навчання класифікатора; «Recognize rhythm» — розпізнавання введеної послідовності. Додатково сторінка містить компактний рядок стану (status bar) під шапкою, бічну панель журналу операцій та дві модальні панелі — довідку («?») та інформацію («ⓘ»)."))
    b(P("Body", "З точки зору архітектури, увесь код розділено на невеликі модулі, кожен з яких експортує один об’єкт у глобальному просторі імен window.AIIP:"))
    b(ul([
        "util.js — допоміжні функції (обмеження значень, середнє, мінімум/максимум, перетворення BPM ↔ RR, форматування, відкладені кадри);",
        "rng.js — детермінований генератор випадкових чисел із зерном (seeded PRNG);",
        "logger.js — журнал операцій (рівні info / success / warning / error, збереження у файл, очищення);",
        "generator.js — генерація набору даних за формулою з методичних вказівок та розбиття на train/test;",
        "model.js — класифікатор (наразі пороговий алгоритм, у другій частині — Brain.js) з єдиним інтерфейсом train / predict / evaluate;",
        "charts.js — графіки на canvas (крива помилки, точність за епохами, діаграма розсіювання, галерея прикладів);",
        "ecg-render.js — побудова зображення результату 1400×800 (ЕКГ-смужка, гістограма RR, смуги ймовірностей);",
        "image-export.js — збереження файлів, зокрема власний 24-бітний BMP-енкодер;",
        "data-step.js, train-step.js, recognize-step.js — логіка трьох кроків роботи;",
        "app.js — ініціалізація, рядок стану, журнал, модальні вікна та самотест застосунку.",
    ]))
    b(P("Body", "Нижче наведено загальний вигляд застосунку після виконання всіх трьох кроків."))
    b(figure(1, 9.0, "Загальний вигляд застосунку після генерації даних, навчання і розпізнавання"))

    # ------------------------------------------------ 5.
    b(H1("5. Інтерфейс застосунку та обґрунтування рішень"))
    b(P("Body", "Нижче описано компонування вікна та окремі проєктні рішення, ухвалені з метою зробити роботу з застосунком зрозумілою, безпечною та передбачуваною."))

    b(H2("5.1 Компонування вікна"))
    b(P("Body", "Вікно поділено на шапку (header) із назвою застосунку, підзаголовком і двома кнопками — «?» (довідка) та «ⓘ» (інформація); рядок стану (status bar) із трьома індикаторами готовності кроків; основну область із трьома картками, розташованими вертикально в порядку виконання роботи; та бічну панель журналу, прикріплену праворуч (sticky), яка залишається видимою під час прокручування. Унизу розміщено підвал із коротким описом способу запуску."))
    b(P("Body", "Порядок карток відповідає природній послідовності роботи: дані → модель → розпізнавання, тому потік даних читається «згори вниз». Усередині кожної картки зліва згруповано параметри (форма), а праворуч — область результатів, що зменшує потребу перемикати увагу."))
    b(P("Body", "Адаптивність забезпечено двома медіа-точками: при ширині вікна до 1280 px рядок стану переноситься, а при ширині до 900 px бічна панель журналу переміщується під основну колонку, щоб зберегти читабельність на вузьких екранах."))
    b(figure(2, 8.5, "Компонування вікна застосунку: шапка, рядок стану, три картки кроків і панель журналу"))

    b(H2("5.2 Захист від неправильної послідовності дій"))
    b(P("Body", "Щоб користувач не міг виконати дію в неправильному порядку, застосунок активно блокує недоступні кроки та пояснює причину. Кнопка «Train» вимкнена, доки не згенеровано або не завантажено набір даних; її підказка при цьому показує «generate a dataset first». Кнопка «Recognize» та кнопки збереження результату вимкнені, доки немає навченої чи завантаженої моделі (підказка «train or load a model first»). Кнопки збереження набору недоступні до його генерації."))
    b(P("Body", "Під час виконання тривалої операції відповідні елементи керування блокуються, а підказка змінюється на «busy — wait for the current operation». Поля, що стосуються безпосередньо нейронної мережі (Learning rate, Momentum, Hidden neurons), показані, але вимкнені, з поясненням, що вони стануть активними після інтеграції Brain.js у другій частині роботи. Це дозволяє вже зараз показати повну структуру майбутнього керування, не вводячи користувача в оману."))

    b(H2("5.3 Перевірка введених даних"))
    b(P("Body", "Усі форми перевіряються під час подання. Для форми генерації перевіряються: кількість прикладів на клас — ціле в межах 10–5000; кількість значень у послідовності K — ціле в межах 3–12; допуск (tolerance) — число в межах 0–20; частка тестової вибірки — ціле в межах 5–50; зерно генератора — порожнє або ціле до 999999999; для кожного класу має виконуватися 20 ≤ min < max ≤ 300. Для навчання перевіряються: кількість епох — ціле в межах 1–20000; поріг ранньої зупинки — число 0–0.5 або порожнє значення."))
    b(P("Body", "У разі помилки над формою з’являється список повідомлень, відповідні поля підсвічуються червоним, фокус переміщується на перше помилкове поле, а подія дублюється в журнал. Для введення послідовності кожне значення мусить бути числом; для одиниць BPM приймаються значення 20–300, для RR — 200–3000 мс; повідомлення мають вигляд «2500 BPM is outside 20..300». Якщо послідовність коротша за K або довша за 200 значень, виводяться окремі повідомлення."))

    b(H2("5.4 Індикатори прогресу"))
    b(P("Body", "Кожен із трьох кроків має власний реальний індикатор прогресу (progress bar), оскільки операції можуть тривати помітний час. Генерація проходить етапи «generating sequences…» → «split T train / S test» → «summarizing…» → 100 %. Навчання оновлюється щонайменше раз на епоху та показує «epoch e/epochs · error … · train …%», а після завершення — «evaluating on N test sequences…». Розпізнавання проходить етапи «predicting…» → «rendering result image…» → 100 %."))
    b(P("Body", "Колір заливки індикатора сигналізує про стан операції: фіолетовий — виконання, зелений — успішне завершення, жовтий — надіслано запит на зупинку, червоний — помилка. Завдяки цьому стан зрозумілий навіть без читання тексту."))
    b(figure(3, 8.0, "Процес навчання моделі: індикатор прогресу та графіки помилки й точності за епохами"))

    b(H2("5.5 Заповнювачі (placeholders)"))
    b(P("Body", "Щоб порожні області не виглядали як зламаний інтерфейс, кожна з них до появи даних містить текстовий заповнювач, який зникає щойно з’являється відповідний результат. Такими областями є «Spread by class» і «Sample sequences» (картка генерації), «Error per epoch» (картка навчання) та «Result image» (картка розпізнавання). Заповнювач пояснює, що саме з’явиться в цій області після виконання операції."))
    b(figure(4, 7.0, "Початковий стан застосунку: текстові заповнювачі в порожніх областях результатів"))

    b(H2("5.6 Іконка «Інформація»"))
    b(P("Body", "Кнопка «ⓘ» відкриває модальне вікно з технічними деталями, згрупованими за розділами: Dataset (діапазони класів, K, розбиття train/test, допуск, зерно, перелік класів); Model (рушій — threshold, джерело, межі low/high у BPM, кодування, точність на тестовій вибірці); Result image (роздільність 1400×800 px, кількість пікселів, масштаб на екрані, розміри у байтах для PNG, JPG і BMP); Last loaded file (ім’я, розширення, розмір, MIME-тип, дата останньої зміни); Last saved file (ім’я, розмір); Environment (рушій моделі, стан brain.js — «not integrated yet», рядок браузера)."))
    b(P("Body", "Усі дані беруться з поточного стану застосунку, тому вікно є зручним інструментом самоперевірки. Кнопка «?» відкриває довідку з описом робочого процесу, діапазонів класів та обмежень застосунку."))
    b(figure(5, 8.0, "Модальне вікно «Інформація» з технічними деталями набору, моделі та файлів"))

    b(H2("5.7 Збереження результатів"))
    b(P("Body", "Застосунок дозволяє зберігати як проміжні, так і кінцеві результати. Набір даних експортується у форматах CSV та JSON, модель — у JSON, зображення результату — у PNG, JPG або BMP (роздільність 1400×800), текстовий звіт результату та журнал — у TXT. Для формату BMP реалізовано власний 24-бітний енкодер, який формує бінарні структури заголовка файлу та заголовка зображення і доповнює довжину рядка до 4 байт. Збережені файли перелічено в таблиці 1."))
    b(P("Caption", "Таблиця 1 - Файли, які зберігає застосунок"))
    b(table(
        ["Тип даних", "Формат", "Ім’я файлу", "Призначення"],
        [
            ["Набір даних", "CSV", "ecg_dataset_K<k>_<дата-час>.csv", "Генерація/обмін даними у текстовому вигляді"],
            ["Набір даних", "JSON", "ecg_dataset_K<k>_<дата-час>.json", "Повне збереження з метаданими"],
            ["Модель", "JSON", "ecg_model_K<k>-thr_<дата-час>.json", "Збереження та відновлення класифікатора"],
            ["Зображення", "PNG / JPG / BMP", "ecg_result_<дата-час>.<ext>", "Візуальний результат розпізнавання"],
            ["Текст результату", "TXT", "ecg_result_<дата-час>.txt", "Прогноз, ймовірності, вікна, інформація про модель"],
            ["Журнал", "TXT", "ecg_log_<дата-час>.txt", "Повний журнал операцій"],
        ],
        [18, 16, 34, 32], "T1"))
    b(figure(6, 7.5, "Збережене зображення результату розпізнавання (1394×800 при масштабуванні 1400×800)"))

    b(H2("5.8 Кольори, доступність, адаптивність"))
    b(P("Body", "Інтерфейс використовує темну тему. Для класів застосовано колірно-безпечну палітру Okabe–Ito: нормальний ритм — синій #0072B2, тахікардія — оранжевий #E69F00, брадикардія — зелений #009E73. Ці кольори використано послідовно в діаграмі розсіювання, галереї, смугах ймовірностей, рядку стану та зображенні результату. Колір завжди дублюється текстовою назвою класу, тому інтерфейс залишається зрозумілим для людей із порушеннями кольорового зору та при чорно-білому друці."))
    b(P("Body", "Доступність забезпечено семантичною розміткою (header, main, aside, nav, dialog), ARIA-атрибутами (role=\"alert\" для повідомлень, role=\"log\" для журналу, role=\"progressbar\" з aria-valuenow для індикаторів, aria-live для панелі результату), можливістю керування з клавіатури та текстовими підписами на всіх кнопках. Адаптивність реалізовано двома медіа-точками (1280 px і 900 px)."))

    b(H2("5.9 Інші рішення, ухвалені під час проєктування"))
    b(ul([
        "рання зупинка (early stop) вимкнена за замовчуванням (поле порожнє), щоб крива помилки була повною; користувач може задати поріг за потреби;",
        "для розпізнавання довших послідовностей використовується ковзне вікно розміру K із кроком 1 та усередненням ймовірностей по вікнах;",
        "при низькій середній упевненості та при виході BPM за межі навчальних даних виводяться попередження (не помилки), щоб не блокувати роботу;",
        "рушій класифікації наразі є пороговим алгоритмом із підбором меж; інтерфейс моделі (train / predict / evaluate / toJSON / fromJSON) зроблено стабільним, тож у другій частині Brain.js підключається без змін графічного інтерфейсу;",
        "результати зберігаються засобами браузера через тимчасові посилання (object URL), без сервера та мережі.",
    ]))

    # ------------------------------------------------ 6.
    b(H1("6. Сценарії використання"))
    b(P("Body", "Типові сценарії використання описано в таблиці 2, а нетипові дії користувача та реакцію застосунку — у таблиці 3."))
    b(P("Caption", "Таблиця 2 - Типові сценарії використання (User Stories)"))
    b(table(
        ["№", "Як…", "я хочу…", "щоб…"],
        [
            ["1", "студент", "згенерувати понад 250 послідовностей ЧСС трьох класів із заданими параметрами", "навчити мережу на репрезентативних даних"],
            ["2", "студент", "задати кількість епох і швидкість навчання та бачити прогрес по епохах і графіки", "контролювати навчання і порівнювати параметри"],
            ["3", "користувач", "ввести послідовність ЧСС (або RR-інтервали) чи обрати приклад", "отримати клас ритму з відсотком упевненості та ЕКГ-візуалізацію"],
            ["4", "користувач", "зберегти зображення результату в PNG, JPG або BMP і текстовий результат", "додати їх до звіту"],
            ["5", "студент", "зберегти модель і набір даних, а потім завантажити їх", "не повторювати генерацію і навчання"],
            ["6", "викладач", "бачити журнал операцій і зберегти його у файл", "перевірити хід роботи і отримані значення"],
        ],
        [6, 16, 46, 32], "T2"))
    b(P("Caption", "Таблиця 3 - Нетипові дії та реакція інтерфейсу"))
    b(table(
        ["Ситуація", "Реакція застосунку"],
        [
            ["Спроба навчання без набору даних", "Кнопка «Train» неактивна; під нею підказка про крок генерації"],
            ["Введення нечислового значення", "Помилка «not a number: \"abc\"»"],
            ["Введення BPM поза діапазоном 20–300", "Помилка «2500 BPM is outside 20..300»"],
            ["Послідовність коротша за K", "Помилка «sequence must have at least K=4 values, got 2»"],
            ["Послідовність довша за 200 значень", "Помилка «sequence too long: 250 values, max 200»"],
            ["Клас, де min ≥ max", "Помилка валідації форми з підсвічуванням поля"],
            ["Завантаження моделі з іншим K", "Помилка «model K=5 does not match dataset K=4»"],
            ["Низька середня впевненість моделі", "Попередження «ambiguous sequence: averaged confidence …»"],
            ["BPM поза діапазоном навчальних даних", "Попередження «BPM is outside the training range …»"],
            ["Натискання «Clear» у журналі", "Запит на підтвердження перед очищенням"],
        ],
        [50, 50], "T3"))

    # ------------------------------------------------ 7.
    b(H1("7. Опис елементів інтерфейсу"))
    b(P("Body", "Нижче наведено перелік елементів інтерфейсу з їхнім призначенням, дією користувача та реакцією застосунку. Нумерація елементів наскрізна (1–45)."))

    b(figure(7, 8.5, "Шапка, рядок стану та картка генерації набору даних"))
    b(P("Caption", "Таблиця 4 - Елементи шапки, рядка стану та кроку генерації даних"))
    b(table(
        ["№", "Елемент і призначення", "Дія користувача", "Що відбувається в застосунку"],
        [
            ["1", "Кнопка «?» — довідка", "Натиснути", "Відкривається модальне вікно довідки"],
            ["2", "Кнопка «ⓘ» — інформація", "Натиснути", "Відкривається модальне вікно з технічними деталями"],
            ["3", "Рядок стану (Data / Model / Recognition)", "Натиснути індикатор", "Прокрутка до відповідного кроку; колір показує стан готовності"],
            ["4", "Поле «Sequences per class»", "Ввести число", "Задає кількість прикладів на кожен клас"],
            ["5", "Поле «Values per sequence (K)»", "Ввести число", "Задає довжину послідовності"],
            ["6", "Поле «Tolerance, BPM»", "Ввести число", "Задає розкид значень у межах послідовності"],
            ["7", "Поле «Test split, %»", "Ввести число", "Задає частку тестової вибірки"],
            ["8", "Поле «Seed»", "Ввести число або лишити порожнім", "Задає зерно генератора; порожнє — випадкове"],
            ["9", "Група «Ranges, BPM»", "Змінити межі для класу", "Задає діапазони BPM для трьох класів"],
            ["10", "Індикатор прогресу генерації", "Спостерігати", "Показує етап генерації набору даних"],
            ["11", "Кнопка «Generate»", "Натиснути", "Генерує набір даних, показує зведення та діаграми"],
            ["12", "Кнопки «Save CSV» / «Save JSON»", "Натиснути", "Зберігає поточний набір даних у вибраному форматі"],
            ["13", "Кнопка «Load dataset…»", "Вибрати файл .csv або .json", "Завантажує набір даних і перебудовує розбиття"],
            ["14", "Зведення набору (плитки)", "Спостерігати", "Показує кількості, розбиття, зерно та діапазони"],
            ["15", "Діаграма «Spread by class»", "Спостерігати", "Показує розподіл значень за класами"],
            ["16", "Галерея «Sample sequences»", "Спостерігати", "Показує приклади згенерованих послідовностей"],
        ],
        [5, 27, 24, 44], "T4"))

    b(figure(8, 8.5, "Картка навчання моделі: параметри, підсумок, матриця помилок, метрики та криві"))
    b(P("Caption", "Таблиця 5 - Елементи кроку навчання моделі"))
    b(table(
        ["№", "Елемент і призначення", "Дія користувача", "Що відбувається в застосунку"],
        [
            ["17", "Поле «Epochs»", "Ввести число", "Задає кількість епох навчання"],
            ["18", "Поле «Early stop, error»", "Ввести число або лишити порожнім", "Задає поріг ранньої зупинки навчання"],
            ["19", "Поле «Learning rate»", "— (вимкнене)", "Стане активним після інтеграції Brain.js у 2-й частині"],
            ["20", "Поле «Momentum»", "— (вимкнене)", "Стане активним після інтеграції Brain.js у 2-й частині"],
            ["21", "Поле «Hidden neurons»", "— (вимкнене)", "Стане активним після інтеграції Brain.js у 2-й частині"],
            ["22", "Індикатор прогресу навчання", "Спостерігати", "Показує епоху, помилку та точність"],
            ["23", "Кнопка «Train»", "Натиснути", "Запускає навчання класифікатора"],
            ["24", "Кнопка «Stop»", "Натиснути", "Завершує навчання після поточної епохи"],
            ["25", "Кнопка «Save model»", "Натиснути", "Зберігає модель у JSON"],
            ["26", "Кнопка «Load model…»", "Вибрати файл .json", "Завантажує модель і перевіряє сумісність K"],
            ["27", "Підсумок моделі", "Спостерігати", "Показує рушій, межі та точність на тесті"],
            ["28", "Матриця помилок", "Спостерігати", "Показує розподіл передбачень 3×3 за класами"],
            ["29", "Метрики", "Спостерігати", "Показує accuracy, macro F1, крос-ентропію та P/R/F1 за класами"],
            ["30", "Список помилкових класифікацій", "Спостерігати", "Показує перші 20 помилкових вікон із деталями"],
            ["31", "Графік «Error per epoch»", "Спостерігати", "Показує криву помилки за епохами"],
            ["32", "Графік «Accuracy per epoch»", "Спостерігати", "Показує криву точності за епохами"],
        ],
        [5, 27, 24, 44], "T5"))

    b(figure(9, 8.5, "Картка розпізнавання: результат, смуги ймовірностей, таблиця вікон і зображення"))
    b(P("Caption", "Таблиця 6 - Елементи кроку розпізнавання ритму"))
    b(table(
        ["№", "Елемент і призначення", "Дія користувача", "Що відбувається в застосунку"],
        [
            ["33", "Поле введення послідовності", "Ввести значення через кому", "Формує вхідну послідовність для розпізнавання"],
            ["34", "Селектор одиниць «BPM / RR, ms»", "Вибрати одиницю", "Визначає, як інтерпретувати введені значення"],
            ["35", "Кнопка «Recognize»", "Натиснути", "Запускає розпізнавання послідовності"],
            ["36", "Кнопки-приклади", "Натиснути Normal/Tachycardia/Bradycardia/Random", "Підставляє приклад послідовності у поле"],
            ["37", "Кнопка «Load sequence…»", "Вибрати файл .txt або .csv", "Завантажує послідовність і визначає одиницю автоматично"],
            ["38", "Індикатор прогресу розпізнавання", "Спостерігати", "Показує етапи прогнозування та рендерингу"],
            ["39", "Панель результату", "Спостерігати", "Показує клас, упевненість і смуги ймовірностей за класами"],
            ["40", "Таблиця «Window details»", "Спостерігати", "Показує результат для кожного вікна: значення, середнє, прогноз, упевненість"],
            ["41", "Зображення результату", "Спостерігати", "Показує ЕКГ-смужку, гістограму RR та смуги ймовірностей"],
            ["42", "Кнопки збереження PNG/JPG/BMP/TXT", "Натиснути", "Зберігає зображення результату або текстовий звіт"],
        ],
        [5, 27, 28, 40], "T6"))

    b(figure(10, 6.5, "Панель журналу операцій із рівнями та кнопками збереження й очищення"))
    b(P("Caption", "Таблиця 7 - Елементи панелі журналу"))
    b(table(
        ["№", "Елемент і призначення", "Дія користувача", "Що відбувається в застосунку"],
        [
            ["43", "Список записів журналу та лічильник", "Спостерігати", "Показує час, рівень і текст кожної операції"],
            ["44", "Кнопка «Save log»", "Натиснути", "Зберігає журнал у файл ecg_log_<дата-час>.txt"],
            ["45", "Кнопка «Clear»", "Натиснути та підтвердити", "Очищає журнал після запиту підтвердження"],
        ],
        [5, 30, 25, 40], "T7"))

    b(figure(11, 8.0, "Модальне вікно довідки з описом робочого процесу та обмежень"))
    b(P("Body", "На рисунку 12 показано реакцію застосунку на помилкові параметри генерації, а на рисунку 13 — на помилку у введеній послідовності."))
    b(figure(12, 6.5, "Повідомлення про помилки валідації форми генерації набору даних"))
    b(figure(13, 6.0, "Повідомлення про помилку в послідовності під час розпізнавання"))
    b(figure(14, 7.5, "Збережені графіки навчання (криві помилки та точності)"))

    # ------------------------------------------------ 8.
    b(H1("8. Зміни інтерфейсу під час розробки"))
    b(P("Body", "У процесі розробки частину первісних рішень було переглянуто та змінено. Найважливіші зміни наведено в таблиці 8."))
    b(P("Caption", "Таблиця 8 - Змінені рішення"))
    b(table(
        ["№", "Первісне рішення", "Ухвалена зміна", "Причина зміни"],
        [
            ["1", "Одна спільна смуга прогресу", "Три окремі індикатори", "Прозорість і незалежність кроків"],
            ["2", "Панель журналу внизу сторінки", "Бічна прикріплена панель (sticky)", "Журнал має бути видимим під час роботи"],
            ["3", "Поля нейромережі приховані", "Показані, але вимкнені з поясненням", "Підготовка до Brain.js у 2-й частині"],
            ["4", "Один формат збереження зображень", "Три формати PNG / JPG / BMP", "Вимога методичних вказівок"],
            ["5", "Фіксовані діапазони класів", "Редаговані поля «Ranges, BPM»", "Гнучкість для експериментів"],
            ["6", "Лише BPM на вході", "Перемикач BPM / RR, ms з автовизначенням", "Зручність і відповідність різним джерелам даних"],
            ["7", "Порожні області без пояснень", "Текстові заповнювачі", "Краще сприйняття початкового стану"],
            ["8", "Відсутність зведення стану", "Рядок стану з трьома індикаторами", "Швидкий огляд готовності кроків"],
        ],
        [5, 28, 34, 33], "T8"))

    # ------------------------------------------------ 9.
    b(H1("9. Можливі покращення"))
    b(ul([
        "винесення навчання у Web Worker, щоб інтерфейс не блокувався під час тривалих обчислень;",
        "пакетне розпізнавання кількох послідовностей одночасно;",
        "імпорт реальних записів ЕКГ, а не лише синтетичних даних;",
        "збереження та відновлення повного стану сесії (набір, модель, налаштування);",
        "світла тема та налаштування розміру шрифту;",
        "перетягування файлів (drag-and-drop) у відповідні області;",
        "експорт діаграм у формати SVG та PDF;",
        "клавіатурні скорочення для частих дій;",
        "візуалізація впевненості кожного вікна безпосередньо на графіку.",
    ]))

    # ------------------------------------------------ 10.
    b(H1("10. Висновок"))
    b(P("Body", "У межах першої частини лабораторної роботи розроблено графічний інтерфейс користувача вебзастосунку для розпізнавання серцевих ритмів трьох класів (нормальний, тахікардія, брадикардія) відповідно до варіанта 6. Застосунок реалізовано як локальний односторінковий застосунок на HTML5, CSS3 та JavaScript без серверної частини."))
    b(P("Body", "Інтерфейс організовано у три послідовні кроки (генерація даних, навчання, розпізнавання), захищено від неправильної послідовності дій, оснащено перевіркою введених даних, реальними індикаторами прогресу, журналом операцій, довідкою та інформаційною панеллю. Результати зберігаються у форматах CSV, JSON, PNG, JPG, BMP та TXT. Для класів використано колірно-безпечну палітру, а назви класів завжди супроводжуються текстом."))
    b(P("Body", "Рушій класифікації на цьому етапі є пороговим алгоритмом із підбором меж, проте інтерфейс моделі зроблено уніфікованим, що дозволить у другій частині роботи підключити Brain.js без зміни графічного інтерфейсу."))
    b(PX("BodyFirst", "Вихідний код застосунку доступний у репозиторії: " + A("https://github.com/danylo-volchenko/poly-aiip", "https://github.com/danylo-volchenko/poly-aiip") + "."))

    return "".join(out)


# ---------------------------------------------------------------- build
def load_prefix():
    xml = open(os.path.join(TEMPLATE_DIR, "content.xml"), encoding="utf-8").read()
    i = xml.find("<office:automatic-styles>")
    return xml[:i]

def make_content(pages):
    prefix = load_prefix()
    seq = ('<text:sequence-decls><text:sequence-decl text:display-outline-level="0" text:name="Illustration"/>'
           '<text:sequence-decl text:display-outline-level="0" text:name="Table"/>'
           '<text:sequence-decl text:display-outline-level="0" text:name="Text"/>'
           '<text:sequence-decl text:display-outline-level="0" text:name="Drawing"/>'
           '<text:sequence-decl text:display-outline-level="0" text:name="Figure"/></text:sequence-decls>')
    return (prefix
            + "<office:automatic-styles>" + "".join(STYLES) + "</office:automatic-styles>"
            + '<office:body><office:text text:use-soft-page-breaks="true">'
            + seq + build_body(pages)
            + "</office:text></office:body></office:document-content>")

MANIFEST = ('<?xml version="1.0" encoding="UTF-8"?>\n'
            '<manifest:manifest xmlns:manifest="urn:oasis:names:tc:opendocument:xmlns:manifest:1.0" manifest:version="1.4">'
            '<manifest:file-entry manifest:full-path="/" manifest:version="1.4" manifest:media-type="application/vnd.oasis.opendocument.text"/>'
            '<manifest:file-entry manifest:full-path="content.xml" manifest:media-type="text/xml"/>'
            '<manifest:file-entry manifest:full-path="styles.xml" manifest:media-type="text/xml"/>'
            '<manifest:file-entry manifest:full-path="meta.xml" manifest:media-type="text/xml"/>'
            '<manifest:file-entry manifest:full-path="settings.xml" manifest:media-type="text/xml"/>'
            '</manifest:manifest>')

def make_styles():
    s = open(os.path.join(TEMPLATE_DIR, "styles.xml"), encoding="utf-8").read()
    s = s.replace('fo:page-width="21.59cm" fo:page-height="27.94cm"',
                  f'fo:page-width="{PAGE_W}" fo:page-height="{PAGE_H}"')
    return s

def make_meta():
    m = open(os.path.join(TEMPLATE_DIR, "meta.xml"), encoding="utf-8").read()
    return m

def package(content_xml, path):
    with zipfile.ZipFile(path, "w") as z:
        z.writestr(zipfile.ZipInfo("mimetype"), "application/vnd.oasis.opendocument.text",
                   compress_type=zipfile.ZIP_STORED)
        z.writestr("META-INF/manifest.xml", MANIFEST, zipfile.ZIP_DEFLATED)
        z.writestr("content.xml", content_xml, zipfile.ZIP_DEFLATED)
        z.writestr("styles.xml", make_styles(), zipfile.ZIP_DEFLATED)
        z.writestr("meta.xml", make_meta(), zipfile.ZIP_DEFLATED)
        z.writestr("settings.xml", open(os.path.join(TEMPLATE_DIR, "settings.xml"), encoding="utf-8").read(),
                   zipfile.ZIP_DEFLATED)

def build(pages, path=OUT_ODT):
    package(make_content(pages), path)

if __name__ == "__main__":
    build({}, OUT_ODT)
    print("wrote", OUT_ODT, os.path.getsize(OUT_ODT), "bytes")
