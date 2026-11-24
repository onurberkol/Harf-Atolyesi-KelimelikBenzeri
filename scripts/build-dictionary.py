from pathlib import Path
import hashlib
import json
import re
import sqlite3
import unicodedata

workspace=Path('dictionary-source')
game=Path('game')
turkish=set((workspace/'tr-full.txt').read_text().splitlines())
turkish.update((workspace/'tr-checked.txt').read_text().splitlines())
headwords=workspace/'zemberek-headwords.dict'
for line in headwords.read_text().splitlines():
    lemma, _, tags=unicodedata.normalize('NFC',line).strip().partition(' [')
    if not re.fullmatch(r'[abcçdefgğhıijklmnoöprsştuüvyzâîû]{2,13}',lemma):
        continue
    if re.search(r'\b(?:Prop|Abbrv|RegAbbrv)\b',tags):
        continue
    turkish.add(lemma.replace('i','İ').upper().translate(str.maketrans('ÂÎÛ','AIU')))
verified_headwords = {
    'PED': 'https://sozluk.gov.tr/gts?ara=ped',
    'ER': 'https://eski.sozluk.gov.tr/?ara=er',
    'AF': 'https://sozluk.gov.tr/gts?ara=af',
    'FA': 'https://sozluk.gov.tr/gts?ara=fa',
}
turkish.update(verified_headwords)
english_sources=[workspace/name for name in ('en-us.txt','en-gb.txt','en-us-large.txt','en-gb-large.txt','en-ca-large.txt','en-au-large.txt')]
english=sorted({
    word.upper()
    for source in english_sources
    for word in source.read_text().splitlines()
    if re.fullmatch(r'[a-z]{2,13}',word)
})
words={'tr':sorted(set(turkish)),'en':english}
for language,entries in words.items():
    if len(entries)<50000:
        raise ValueError(f'{language} has only {len(entries)} dictionary entries')

sources={
    'tr':'Blinkered Turkish (CC0 1.0); analyzed with Zeyrek 0.1.3; Zemberek master headwords (Apache-2.0)',
    'en':'English Speller Database / SCOWL 2026.02.25, US, UK, Canada and Australia, standard and large',
}
notice=[
    'Harf Atölyesi / Letter Workshop — offline game dictionary',
    'Only words of 2–13 playable letters are included. Turkish uses locale-specific I/İ and folds circumflex accents to tile letters.',
    'Turkish combines attested forms with a non-name, non-abbreviation morphological analysis and eligible Zemberek headwords.',
    'English combines lowercase American, British, Canadian and Australian headwords and inflected forms; capitalized entries and punctuation are excluded.',
    'The checks are automated and the resulting lists are open to correction.',
    *[f'TDK-verified supplement: {word} — {url}' for word,url in verified_headwords.items()],
    '',
]
for language,files in [('tr',[workspace/'tr-words.txt',headwords]),('en',english_sources)]:
    notice.extend([f'{language}: {len(words[language]):,} entries — {sources[language]}'])
    notice.extend(f'  {file.name} SHA-256: {hashlib.sha256(file.read_bytes()).hexdigest()}' for file in files)
notice.extend(['',
    'Turkish word list: https://github.com/blinkered/blinkered-dictionary-tr',
    'Turkish morphology: https://github.com/obulat/zeyrek',
    'Zemberek source: https://github.com/ahmetaa/zemberek-nlp/blob/master/morphology/src/main/resources/tr/master-dictionary.dict',
    '',(workspace/'zemberek-license.txt').read_text(),
    '',(workspace/'apache-2.0.txt').read_text(),
    'English source: https://github.com/en-wl/wordlist-diff/tree/rel-2026.02.25',
    '',(workspace/'tr-dictionary-notice.txt').read_text(),
    '',(workspace/'en-dictionary-notice.txt').read_text()])
(game/'Dictionary-notices.txt').write_text('\n'.join(notice))

payload=json.dumps({language:' '.join(entries) for language,entries in words.items()},ensure_ascii=False,separators=(',',':'))
(game/'dictionary.js').write_text(
    '// Generated offline dictionary. Source terms are in Dictionary-notices.txt.\n'
    f'const WordLists = {payload};\n'
    "if (typeof module !== 'undefined') module.exports = WordLists;\n"
)
db=workspace/'game-dictionary.sqlite3'
db.unlink(missing_ok=True)
with sqlite3.connect(db) as conn:
    conn.executescript("""
        CREATE TABLE words (
            language TEXT NOT NULL CHECK (language IN ('tr','en')),
            word TEXT NOT NULL CHECK (length(word) BETWEEN 2 AND 13),
            PRIMARY KEY (language, word)
        ) WITHOUT ROWID;
        CREATE TABLE metadata (name TEXT PRIMARY KEY, value TEXT NOT NULL) WITHOUT ROWID;
    """)
    conn.executemany('INSERT INTO words VALUES (?,?)',
        ((language,word) for language,entries in words.items() for word in entries))
    conn.executemany('INSERT INTO metadata VALUES (?,?)',[
        ('sources_and_license','\n'.join(notice)),
        *[(f'{language}_count',str(len(entries))) for language,entries in words.items()]
    ])
    assert conn.execute('PRAGMA integrity_check').fetchone()==('ok',)
db.replace('game/harf-atolyesi-kelime-sozlugu.sqlite3')
print({language:len(entries) for language,entries in words.items()})
