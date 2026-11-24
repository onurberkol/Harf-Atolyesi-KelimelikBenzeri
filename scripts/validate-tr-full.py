from multiprocessing import get_context
from pathlib import Path
import logging
import re
import sys
import unicodedata

from zeyrek import MorphAnalyzer
from zeyrek.attributes import RootAttribute, SecondaryPos

logging.disable(logging.CRITICAL)
analyzer=MorphAnalyzer()
excluded={SecondaryPos.ProperNoun,SecondaryPos.Abbreviation,SecondaryPos.RegularAbbreviation}
alphabet=re.compile('[ABCÇDEFGĞHIİJKLMNOÖPRSŞTUÜVYZ]{2,13}')
accent_map=str.maketrans('ÂÎÛ','AIU')

def approved(word):
    if any(analysis.dict_item.secondary_pos not in excluded and
           RootAttribute.Runtime not in analysis.dict_item.attributes
           for analysis in analyzer._parse(word)):
        return word
    return ''

def candidates():
    seen=set()
    for line in Path('dictionary-source/tr-words.txt').open():
        word=unicodedata.normalize('NFC',line.strip()).translate(accent_map)
        if alphabet.fullmatch(word) and word not in seen:
            seen.add(word)
            yield word

if __name__=='__main__':
    with get_context('fork').Pool(6) as pool:
        accepted=list(filter(None,pool.imap(approved,candidates(),chunksize=256)))
    if len(accepted)<50000:
        raise SystemExit(f'Only {len(accepted)} checked Turkish entries')
    Path('dictionary-source/tr-full.txt').write_text('\n'.join(accepted)+'\n')
    print(f'{len(accepted):,} Turkish entries passed attestation and morphological analysis')
