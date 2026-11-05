#!/usr/bin/lua
-- No credentials are accepted in arguments or emitted in logs.
local json=require('luci.jsonc')
local function read(path)local f=io.open(path);if not f then return nil end;local s=f:read('*a');f:close();return s end
local function write(path,s)local f=assert(io.open(path,'w'));f:write(s);f:close()end
local function quote(s)return "'"..tostring(s):gsub("'","'\\''").."'" end
local function valid_domain(s)return type(s)=='string' and #s<=253 and s:match('^[a-z0-9][a-z0-9%.%-]+[a-z0-9]$') and not s:find('%.%.')end
local function ipv4(s)
 if type(s)~='string' or not s:match('^%d+%.%d+%.%d+%.%d+$')then return false end
 local n=0;for part in s:gmatch('%d+')do n=n+1;if tonumber(part)>255 then return false end end;return n==4
end
local function worker(manifest,index,output)
 local record=manifest.records[index];if not record or not valid_domain(record.domain)then return end
 local best=nil;local tried=0
 for _,ip in ipairs(record.candidates or {})do
  if ipv4(ip)then
   tried=tried+1;if tried>3 then break end
   local samples={}
   for attempt=1,3 do
    -- gid 65534 is the verified OpenClash output bypass. TLS/SNI stays the real domain.
    local cmd="start-stop-daemon -S -p /tmp/custom-hosts-probe-no-process.pid -c root:nogroup -x /usr/bin/curl -- --proxy '' --noproxy '*' --connect-timeout 2 --max-time 3 --resolve "..quote(record.domain..':443:'..ip).." -I -s -o /dev/null -w '%{http_code} %{remote_ip} %{time_total}' "..quote('https://'..record.domain..'/')..' 2>/dev/null'
    local pipe=assert(io.popen(cmd));local result=pipe:read('*a');pipe:close()
    local status,remote,seconds=result:match('^(%d%d%d) ([^ ]+) ([%d%.]+)$');local code=tonumber(status)
    if not code or not (code>=200 and code<400 or code==401 or code==403 or code==404 or code==405) or remote~=ip or not tonumber(seconds) or tonumber(seconds)<=0 then break end
    samples[#samples+1]=tonumber(seconds)*1000
   end
   if #samples==3 then
    table.sort(samples);if not best or samples[2]<best.samples[2]then best={domain=record.domain,ip=ip,samples=samples,network='direct',testedAt=os.date('!%Y-%m-%dT%H:%M:%SZ')}end
   end
  end
 end
 write(output,json.stringify(best or {domain=record.domain,failed=true}))
end
if arg[1]=='--worker'then
 local m=json.parse(assert(read(arg[2])));worker(m,tonumber(arg[3]),arg[4]);return
end
local config='/etc/custom-hosts-probe.curl'
if not read(config)then error('Probe credential configuration is missing')end
-- Fail closed if the transparent-proxy bypass disappeared after a firewall change.
local pipe=assert(io.popen("nft list chain inet fw4 openclash_output 2>/dev/null"));local rules=pipe:read('*a');pipe:close()
if not rules:match('meta skgid 65534[^\n]*return')then error('OpenClash direct bypass is unavailable; no report submitted')end
local temp=os.tmpname();os.remove(temp);assert(os.execute('mkdir -m 700 '..quote(temp))==0)
local function api(path,out,input)
 local command='curl -sS --fail --connect-timeout 5 --max-time 25 --config '..quote(config)..' -o '..quote(out)
 if input then command=command..' -H "Content-Type: application/json" --data-binary @'..quote(input)end
 return os.execute(command..' '..quote('https://custom-hosts-optimizer.violinproxy.workers.dev/api/probe/'..path))==0
end
local manifest_path=temp..'/manifest.json'
if not api('manifest',manifest_path)then os.execute('rm -rf '..quote(temp));error('Manifest download failed')end
local manifest=json.parse(assert(read(manifest_path)));if not manifest or type(manifest.records)~='table' or #manifest.records>300 then error('Invalid manifest')end
for start=1,#manifest.records,4 do
 local commands={}
 for i=start,math.min(start+3,#manifest.records)do commands[#commands+1]='lua /usr/libexec/custom-hosts-probe.lua --worker '..quote(manifest_path)..' '..i..' '..quote(temp..'/'..i..'.json')..' &'end
 os.execute(table.concat(commands,' ')..' wait')
end
local results={};local failures=0
for i=1,#manifest.records do local item=json.parse(read(temp..'/'..i..'.json')or '{}');if item and not item.failed and item.ip then results[#results+1]=item else failures=failures+1 end end
local applied=0
-- Keep reports below 100 items per request and reject failures without changing old IPs.
for start=1,#results,80 do
 local chunk={};for i=start,math.min(start+79,#results)do chunk[#chunk+1]=results[i]end
 local report=temp..'/report.json';write(report,json.stringify({results=chunk}))
 if not api('report',temp..'/response.json',report)then os.execute('rm -rf '..quote(temp));error('Probe report submission failed')end
 local response=json.parse(read(temp..'/response.json')or '{}');applied=applied+(response.applied or 0)
end
write('/tmp/custom-hosts-probe-status.json',json.stringify({testedAt=os.date('!%Y-%m-%dT%H:%M:%SZ'),network='direct',tested=#manifest.records,reachable=#results,failed=failures,applied=applied}))
os.execute('logger -t custom-hosts-probe '..quote('Direct HTTPS: '..#results..'/'..#manifest.records..' reachable; '..applied..' applied, failures retain old IPs'))
os.execute('rm -rf '..quote(temp))
print('Direct HTTPS: '..#results..'/'..#manifest.records..' reachable; '..applied..' applied')
