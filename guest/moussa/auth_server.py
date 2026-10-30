#!/usr/bin/env python3
"""Isolated two-browser-key gate for Moussa family guest. Only local dataset; never mount SAMERAI core."""
from http.server import ThreadingHTTPServer, BaseHTTPRequestHandler
from pathlib import Path
import json, sqlite3, time, hashlib, hmac, secrets, base64
from threading import Lock
from urllib.parse import urlsplit
from cryptography.hazmat.primitives.asymmetric import ec
from cryptography.hazmat.primitives.asymmetric.utils import encode_dss_signature
from cryptography.hazmat.primitives import hashes

ROOT=Path(__file__).resolve().parent
DB=ROOT/'guest_auth.sqlite'
EXPIRES=1795990860 # 29 Nov 2026 19:41 UTC
CODES={1:'7527c31c98ab015b6478f377bd431bdc336c789df2fcc1f5647dfd7dc8d08ee8',2:'facde6fe8d26bf7119f82d65e12c2ea6584ad56b723f37e721b5ef1195841c59'}
LOCK=Lock()
def conn():
 c=sqlite3.connect(str(DB),timeout=5)
 c.execute('PRAGMA busy_timeout=5000')
 return c
def setup():
 with conn() as c:
  c.execute('CREATE TABLE IF NOT EXISTS devices (slot INTEGER PRIMARY KEY CHECK(slot IN (1,2)), public_jwk TEXT NOT NULL, enrolled_at INTEGER NOT NULL, label TEXT NOT NULL)')
  c.execute('CREATE TABLE IF NOT EXISTS challenges (nonce TEXT PRIMARY KEY, slot INTEGER NOT NULL, exp INTEGER NOT NULL, used INTEGER NOT NULL DEFAULT 0)')
  c.execute('CREATE INDEX IF NOT EXISTS ix_auth_challenges_slot ON challenges(slot,exp)')
def b64raw(s):
 return base64.urlsafe_b64decode(s+'='*(-len(s)%4))
def jwk2key(j):
 if not isinstance(j,dict) or j.get('kty')!='EC' or j.get('crv')!='P-256' or 'd' in j:raise ValueError('invalid key')
 x=b64raw(j.get('x',''));y=b64raw(j.get('y',''))
 if len(x)!=32 or len(y)!=32:raise ValueError('invalid point')
 return ec.EllipticCurvePublicNumbers(int.from_bytes(x,'big'),int.from_bytes(y,'big'),ec.SECP256R1()).public_key()
def auth_error():return {'error':'ACCESS_DENIED'}
class Handler(BaseHTTPRequestHandler):
 server_version='FamilyGuest/1.0'
 def log_message(self,format,*args):pass # No secrets, user identifiers or invitation URLs in logs
 def headers_out(self,code,mime):
  self.send_response(code)
  for k,v in {'Content-Type':mime,'Cache-Control':'private, no-store, max-age=0','Pragma':'no-cache','Referrer-Policy':'no-referrer','X-Content-Type-Options':'nosniff','X-Robots-Tag':'noindex, nofollow, noarchive','X-Frame-Options':'DENY','Permissions-Policy':'geolocation=(), camera=(), microphone=()'}.items():self.send_header(k,v)
  if mime.startswith('text/html'):self.send_header('Content-Security-Policy',"default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline'; connect-src 'self'; img-src data:; base-uri 'none'; form-action 'none'; frame-ancestors 'none'")
  self.end_headers()
 def out(self,code,obj):
  data=json.dumps(obj,ensure_ascii=False).encode('utf-8')
  self.headers_out(code,'application/json; charset=utf-8')
  self.wfile.write(data)
 def do_GET(self):
  path=urlsplit(self.path).path
  if path=='/health':return self.out(200,{'status':'ready','expiry':EXPIRES,'limit':2})
  if path not in ['/','/index.html']:return self.out(404,{'error':'not_found'})
  if time.time()>=EXPIRES:return self.out(410,{'error':'expired'})
  data=(ROOT/'index.html').read_bytes()
  self.headers_out(200,'text/html; charset=utf-8')
  self.wfile.write(data)
 def do_POST(self):
  if time.time()>=EXPIRES:return self.out(410,{'error':'EXPIRED'})
  path=urlsplit(self.path).path
  if path not in ('/api/enroll','/api/challenge','/api/data'):return self.out(404,{'error':'not_found'})
  host=self.headers.get('Host','')
  origin=self.headers.get('Origin','')
  if origin and origin not in ('https://'+host,'http://127.0.0.1:8989','http://localhost:8989'):return self.out(403,auth_error())
  try:
   size=int(self.headers.get('Content-Length','0'))
   if size<=0 or size>8192:return self.out(413,{'error':'invalid_payload'})
   data=json.loads(self.rfile.read(size))
   if not isinstance(data,dict):raise ValueError('not object')
   slot=data.get('slot')
   if type(slot)!=int or slot not in (1,2):return self.out(403,auth_error())
   if path=='/api/enroll':
    code=data.get('invite','')
    if not isinstance(code,str) or len(code)>200 or not hmac.compare_digest(hashlib.sha256(code.encode()).hexdigest(),CODES[slot]):return self.out(403,auth_error())
    jwk=data.get('publicKey',{})
    jwk2key(jwk)
    with LOCK:
     with conn() as c:
      exists=c.execute('SELECT 1 FROM devices WHERE slot=?',(slot,)).fetchone()
      if exists:return self.out(409,{'error':'SLOT_ALREADY_BOUND','slot':slot})
      c.execute('INSERT INTO devices(slot,public_jwk,enrolled_at,label) VALUES(?,?,?,?)',(slot,json.dumps(jwk),int(time.time()),'Owner browser' if slot==1 else 'Dany browser'))
    return self.out(201,{'registered':True,'slot':slot,'max_devices':2})
   if path=='/api/challenge':
    with conn() as c:
     if not c.execute('SELECT 1 FROM devices WHERE slot=?',(slot,)).fetchone():return self.out(403,auth_error())
     nonce=secrets.token_urlsafe(24)
     c.execute('DELETE FROM challenges WHERE exp<?',(int(time.time())-60,))
     c.execute('INSERT INTO challenges(nonce,slot,exp,used) VALUES(?,?,?,0)',(nonce,slot,int(time.time())+90))
    return self.out(200,{'slot':slot,'nonce':nonce,'message':f'moussa-v1|{slot}|{nonce}'})
   nonce=data.get('nonce','')
   signature=data.get('signature','')
   if not isinstance(nonce,str) or len(nonce)>120 or not isinstance(signature,str) or len(signature)>400:return self.out(403,auth_error())
   with conn() as c:
    record=c.execute('SELECT public_jwk FROM devices WHERE slot=?',(slot,)).fetchone()
    challenge=c.execute('SELECT exp,used FROM challenges WHERE nonce=? AND slot=?',(nonce,slot)).fetchone()
   if not record or not challenge or challenge[1] or challenge[0]<int(time.time()):return self.out(403,auth_error())
   pub=jwk2key(json.loads(record[0]))
   raw=b64raw(signature)
   if len(raw)!=64:return self.out(403,auth_error())
   der=encode_dss_signature(int.from_bytes(raw[:32],'big'),int.from_bytes(raw[32:],'big'))
   pub.verify(der,f'moussa-v1|{slot}|{nonce}'.encode(),ec.ECDSA(hashes.SHA256()))
   with LOCK:
    with conn() as c:
     cur=c.execute('UPDATE challenges SET used=1 WHERE nonce=? AND slot=? AND used=0 AND exp>=?', (nonce,slot,int(time.time())))
     if cur.rowcount!=1:return self.out(403,auth_error())
   full=json.loads((ROOT/'family_snapshot.json').read_text(encoding='utf-8'))
   allowed={k:full.get(k,[]) for k in ('persons','households','edges','sources','issues')}
   allowed['phones']=[];allowed['vehicles']=[];allowed['addresses']=[];allowed['capacity']=1000
   return self.out(200,allowed)
  except Exception as e:
   return self.out(403,auth_error())
if __name__=='__main__':
 setup()
 print('Moussa two-key guest ready on localhost:8989; expires at UTC timestamp',EXPIRES,flush=True)
 ThreadingHTTPServer(('127.0.0.1',8989),Handler).serve_forever()
