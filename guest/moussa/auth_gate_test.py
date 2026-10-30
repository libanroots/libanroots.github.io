import sys, pathlib, json, tempfile, threading, time, hashlib, base64, shutil
import urllib.request, urllib.error
from cryptography.hazmat.primitives.asymmetric import ec
from cryptography.hazmat.primitives.asymmetric.utils import decode_dss_signature
from cryptography.hazmat.primitives import hashes, serialization
from http.server import ThreadingHTTPServer
ROOT=pathlib.Path(__file__).resolve().parent
sys.path.insert(0,str(ROOT))
import auth_server as mod
testdir=pathlib.Path(tempfile.mkdtemp(prefix="moussa_guest_auth_"))
mod.ROOT=testdir;mod.DB=testdir/'test_auth.sqlite'
mod.CODES={1:hashlib.sha256(b'test-owner').hexdigest(),2:hashlib.sha256(b'test-dany').hexdigest()}
shutil.copy2(ROOT/'family_snapshot.json',testdir/'family_snapshot.json')
shutil.copy2(ROOT/'secure_index.html',testdir/'index.html')
mod.setup()
server=ThreadingHTTPServer(('127.0.0.1',8990),mod.Handler)
threading.Thread(target=server.serve_forever,daemon=True).start()
class Response:
 def __init__(self,code,text):self.status_code=code;self.text=text
 def json(self):return json.loads(self.text)
def get(path):
 try:
  with urllib.request.urlopen('http://127.0.0.1:8990'+path,timeout=10) as response:return Response(response.status,response.read().decode())
 except urllib.error.HTTPError as e:return Response(e.code,e.read().decode())
def post(path,p):
 req=urllib.request.Request('http://127.0.0.1:8990/api/'+path,data=json.dumps(p).encode(),headers={'Content-Type':'application/json'},method='POST')
 try:
  with urllib.request.urlopen(req,timeout=10) as response:return Response(response.status,response.read().decode())
 except urllib.error.HTTPError as e:return Response(e.code,e.read().decode())
def u64(x):return base64.urlsafe_b64encode(x).decode().rstrip('=')
def enroll(slot,code):
 key=ec.generate_private_key(ec.SECP256R1()); p=key.public_key().public_numbers()
 jwk={'kty':'EC','crv':'P-256','x':u64(p.x.to_bytes(32,'big')),'y':u64(p.y.to_bytes(32,'big'))}
 r=post('enroll',{'slot':slot,'invite':code,'publicKey':jwk})
 print('enroll',slot,r.status_code,r.text[:120]);assert r.status_code==201
 return key
try:
 assert post('enroll',{'slot':3,'invite':'test-owner','publicKey':{}}).status_code==403
 assert post('enroll',{'slot':1,'invite':'wrong','publicKey':{}}).status_code==403
 key1=enroll(1,'test-owner')
 key2=enroll(2,'test-dany')
 p=key2.public_key().public_numbers()
 jwk={'kty':'EC','crv':'P-256','x':u64(p.x.to_bytes(32,'big')),'y':u64(p.y.to_bytes(32,'big'))}
 duplicate=post('enroll',{'slot':1,'invite':'test-owner','publicKey':jwk})
 print('third registration',duplicate.status_code);assert duplicate.status_code==409
 c=post('challenge',{'slot':1});assert c.status_code==200
 challenge=c.json();sig=key1.sign(challenge['message'].encode(),ec.ECDSA(hashes.SHA256()))
 r,s=decode_dss_signature(sig);raw=r.to_bytes(32,'big')+s.to_bytes(32,'big')
 data=post('data',{'slot':1,'nonce':challenge['nonce'],'signature':u64(raw)})
 print('authorized',data.status_code,'records',len(data.json().get('persons',[])))
 assert data.status_code==200 and len(data.json()['persons'])==56
 replay=post('data',{'slot':1,'nonce':challenge['nonce'],'signature':u64(raw)})
 print('replay',replay.status_code);assert replay.status_code==403
 fresh=post('challenge',{'slot':2}).json()
 wrong=post('data',{'slot':2,'nonce':fresh['nonce'],'signature':u64(raw)})
 print('wrong signature',wrong.status_code);assert wrong.status_code==403
 assert get('/family_snapshot.json').status_code==404
 print('ALL PASS: 2 registrations; third denied; signed read; replay denied; stolen private data path denied')
finally:
 server.shutdown()
 shutil.rmtree(testdir,ignore_errors=True)
