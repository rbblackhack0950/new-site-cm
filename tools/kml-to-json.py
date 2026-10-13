#!/usr/bin/env python3
"""Converts the DC charging-station KML (Piyamate Wisanuvej's Google My Map) to data/dc-stations.json.
Usage: tools/kml-to-json.py doc.kml data/dc-stations.json"""
import json, re, sys, xml.etree.ElementTree as ET
K = '{http://www.opengis.net/kml/2.2}'
LABELS = [('CCS2', r'CCS\s?2', 1), ('CHAdeMO', r'CHAdeMO', 1), ('GB/T DC', r'GB/?T', 1), ('Type 2', r'Type\s?2', 0), ('Type 1', r'Type\s?1', 0)]
def sockets(desc, prov):
    out = {}
    for seg in re.split(r'[,\n;]', desc):
        kws = [float(x) for x in re.findall(r'(\d+(?:\.\d+)?)\s*kW', seg, re.I)]
        for name, rx, dc in LABELS:
            if re.search(rx, seg, re.I):
                o = out.setdefault(name, [name, 0, dc])
                if kws: o[1] = max(o[1], int(max(kws)))
    # "CCS2 150 kW, CHAdeMO" style with the number in a neighbouring segment is left without kW
    if not out and prov == 'Tesla': out['Supercharger'] = ['Supercharger', 0, 1]
    return list(out.values())
rows = []
for p in ET.parse(sys.argv[1]).getroot().iter(K + 'Placemark'):
    d = {x.get('name'): (x.find(K + 'value').text or '').strip() for x in p.iter(K + 'Data')}
    lng, lat = [float(v) for v in p.find('.//' + K + 'coordinates').text.strip().split(',')[:2]]
    name = (p.find(K + 'name').text or '').strip(); en = d.get('Name-EN', '')
    rows.append([round(lat, 5), round(lng, 5), name or en, en if en != name else '', d.get('Provider', ''), sockets(d.get('Description', ''), d.get('Provider', ''))])
json.dump({'src': 'DC EV Charging Station Thailand - Piyamate Wisanuvej', 's': rows}, open(sys.argv[2], 'w'), ensure_ascii=False, separators=(',', ':'))
print(len(rows), 'stations')
