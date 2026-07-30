# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: error-recovery.spec.ts >> T+480 Chat 错误处理 / 降级 UX >> ER1: 错误端口 (11435) → send → assistant bubble 显示错误
- Location: tests\e2e\error-recovery.spec.ts:30:7

# Error details

```
TimeoutError: locator.click: Timeout 30000ms exceeded.
Call log:
  - waiting for locator('.input-area button:has-text("发送"), .input-area button:has-text("Send")').first()
    - locator resolved to <button type="button" data-v-62fba2dc="" aria-disabled="false" class="el-button el-button--primary el-button--default send-btn">…</button>
  - attempting click action
    - waiting for element to be visible, enabled and stable
    - element is visible, enabled and stable
    - scrolling into view if needed
    - done scrolling
    - <kbd data-v-32928b7b="">⌘K</kbd> from <button data-v-32928b7b="" title="命令面板 (Ctrl+K)" class="floating-cmd-btn">…</button> subtree intercepts pointer events
  - retrying click action
    - waiting for element to be visible, enabled and stable
    - element is visible, enabled and stable
    - scrolling into view if needed
    - done scrolling
    - <button data-v-32928b7b="" title="命令面板 (Ctrl+K)" class="floating-cmd-btn">…</button> intercepts pointer events
  - retrying click action
    - waiting 20ms
    2 × waiting for element to be visible, enabled and stable
      - element is visible, enabled and stable
      - scrolling into view if needed
      - done scrolling
      - <kbd data-v-32928b7b="">⌘K</kbd> from <button data-v-32928b7b="" title="命令面板 (Ctrl+K)" class="floating-cmd-btn">…</button> subtree intercepts pointer events
    - retrying click action
      - waiting 100ms
    14 × waiting for element to be visible, enabled and stable
       - element is visible, enabled and stable
       - scrolling into view if needed
       - done scrolling
       - <kbd data-v-32928b7b="">⌘K</kbd> from <button data-v-32928b7b="" title="命令面板 (Ctrl+K)" class="floating-cmd-btn">…</button> subtree intercepts pointer events
     - retrying click action
       - waiting 500ms
       - waiting for element to be visible, enabled and stable
       - element is visible, enabled and stable
       - scrolling into view if needed
       - done scrolling
       - <button data-v-32928b7b="" title="命令面板 (Ctrl+K)" class="floating-cmd-btn">…</button> intercepts pointer events
     - retrying click action
       - waiting 500ms
       - waiting for element to be visible, enabled and stable
       - element is visible, enabled and stable
       - scrolling into view if needed
       - done scrolling
       - <kbd data-v-32928b7b="">⌘K</kbd> from <button data-v-32928b7b="" title="命令面板 (Ctrl+K)" class="floating-cmd-btn">…</button> subtree intercepts pointer events
     - retrying click action
       - waiting 500ms
       - waiting for element to be visible, enabled and stable
       - element is visible, enabled and stable
       - scrolling into view if needed
       - done scrolling
       - <kbd data-v-32928b7b="">⌘K</kbd> from <button data-v-32928b7b="" title="命令面板 (Ctrl+K)" class="floating-cmd-btn">…</button> subtree intercepts pointer events
     - retrying click action
       - waiting 500ms
    - waiting for element to be visible, enabled and stable
    - element is visible, enabled and stable
    - scrolling into view if needed
    - done scrolling
    - <kbd data-v-32928b7b="">⌘K</kbd> from <button data-v-32928b7b="" title="命令面板 (Ctrl+K)" class="floating-cmd-btn">…</button> subtree intercepts pointer events
  - retrying click action
    - waiting 500ms
    - waiting for element to be visible, enabled and stable
    - element is visible, enabled and stable
    - scrolling into view if needed
    - done scrolling
    - <button data-v-32928b7b="" title="命令面板 (Ctrl+K)" class="floating-cmd-btn">…</button> intercepts pointer events
  - retrying click action
    - waiting 500ms

```

# Page snapshot

```yaml
- generic [ref=e4]:
  - generic [ref=e5]:
    - generic [ref=e7]:
      - img [ref=e9]
      - generic [ref=e11]: PiPiClaw
    - generic [ref=e12]:
      - button "切换到浅色" [ref=e13] [cursor=pointer]:
        - img [ref=e15]
      - button "最小化" [ref=e17] [cursor=pointer]:
        - img [ref=e19]
      - button "还原" [ref=e21] [cursor=pointer]:
        - img [ref=e22]
      - button "关闭" [ref=e25] [cursor=pointer]:
        - img [ref=e27]
  - generic [ref=e29]:
    - complementary [ref=e30]:
      - img [ref=e33]
      - navigation [ref=e36]:
        - generic [ref=e38]:
          - link "工作台" [ref=e39] [cursor=pointer]:
            - /url: "#/dashboard"
            - img [ref=e41]
          - link "AI对话" [ref=e43] [cursor=pointer]:
            - /url: "#/chat"
            - img [ref=e45]
          - link "自动化任务" [ref=e48] [cursor=pointer]:
            - /url: "#/tasks"
            - img [ref=e50]
        - generic [ref=e53]:
          - link "技能管理" [ref=e54] [cursor=pointer]:
            - /url: "#/skills"
            - img [ref=e56]
          - link "技能市场" [ref=e60] [cursor=pointer]:
            - /url: "#/clawhub"
            - img [ref=e62]
          - link "模型管理" [ref=e64] [cursor=pointer]:
            - /url: "#/models"
            - img [ref=e66]
          - link "模型对比" [ref=e69] [cursor=pointer]:
            - /url: "#/model-compare"
            - img [ref=e71]
          - link "IM 管理" [ref=e73] [cursor=pointer]:
            - /url: "#/im-management"
            - img [ref=e75]
          - link "定时任务" [ref=e78] [cursor=pointer]:
            - /url: "#/schedule"
            - img [ref=e80]
        - generic [ref=e83]:
          - link "权限管理" [ref=e84] [cursor=pointer]:
            - /url: "#/permissions"
            - img [ref=e86]
          - link "插件市场" [ref=e89] [cursor=pointer]:
            - /url: "#/plugin-market"
            - img [ref=e91]
          - link "远程控制" [ref=e93] [cursor=pointer]:
            - /url: "#/remote-control"
            - img [ref=e95]
          - link "系统设置" [ref=e98] [cursor=pointer]:
            - /url: "#/settings"
            - img [ref=e100]
          - link "帮助中心" [ref=e102] [cursor=pointer]:
            - /url: "#/help"
            - img [ref=e104]
      - generic [ref=e106]:
        - button "固定展开" [ref=e107] [cursor=pointer]:
          - img [ref=e109]
        - generic "PiPiClaw v30.5.1" [ref=e111] [cursor=pointer]:
          - img [ref=e112]
    - main [ref=e115]:
      - generic [ref=e117]:
        - generic [ref=e118]:
          - generic [ref=e119]:
            - generic [ref=e120]: 会话
            - button "新建对话" [ref=e121] [cursor=pointer]:
              - generic [ref=e122]:
                - img [ref=e124]
                - generic [ref=e126]: 新建
          - generic [ref=e129]:
            - img [ref=e132]
            - textbox "搜索会话..." [ref=e134]
          - generic [ref=e138]:
            - generic [ref=e139]: 最近
            - generic [ref=e140] [cursor=pointer]:
              - generic [ref=e142]:
                - checkbox
              - generic [ref=e144]: 💬
              - generic [ref=e145]: 新对话 2026/7/30 08:38:31
              - button [ref=e147]:
                - img [ref=e148]
            - generic [ref=e150] [cursor=pointer]:
              - generic [ref=e152]:
                - checkbox
              - generic [ref=e154]: 💬
              - generic [ref=e155]: 新对话 2026/7/30 08:36:47
              - button [ref=e157]:
                - img [ref=e158]
            - generic [ref=e160] [cursor=pointer]:
              - generic [ref=e162]:
                - checkbox
              - generic [ref=e164]: 💬
              - generic [ref=e165]: 新对话 2026/7/30 08:36:08
              - button [ref=e167]:
                - img [ref=e168]
            - generic [ref=e170] [cursor=pointer]:
              - generic [ref=e172]:
                - checkbox
              - generic [ref=e174]: 💬
              - generic [ref=e175]: 新对话 2026/7/30 08:35:29
              - button [ref=e177]:
                - img [ref=e178]
            - generic [ref=e180] [cursor=pointer]:
              - generic [ref=e182]:
                - checkbox
              - generic [ref=e184]: 💬
              - generic [ref=e185]: T+420 测试会话
              - button [ref=e187]:
                - img [ref=e188]
            - generic [ref=e190] [cursor=pointer]:
              - generic [ref=e192]:
                - checkbox
              - generic [ref=e194]: 💬
              - generic [ref=e195]: 新对话 2026/7/29 19:06:14
              - button [ref=e197]:
                - img [ref=e198]
            - generic [ref=e200] [cursor=pointer]:
              - generic [ref=e202]:
                - checkbox
              - generic [ref=e204]: 💬
              - generic [ref=e205]: 新对话 2026/7/29 19:06:08
              - button [ref=e207]:
                - img [ref=e208]
            - generic [ref=e210] [cursor=pointer]:
              - generic [ref=e212]:
                - checkbox
              - generic [ref=e214]: 💬
              - generic [ref=e215]: 新对话 2026/7/29 19:05:28
              - button [ref=e217]:
                - img [ref=e218]
            - generic [ref=e220] [cursor=pointer]:
              - generic [ref=e222]:
                - checkbox
              - generic [ref=e224]: 💬
              - generic [ref=e225]: 新对话 2026/7/29 19:03:38
              - button [ref=e227]:
                - img [ref=e228]
            - generic [ref=e230] [cursor=pointer]:
              - generic [ref=e232]:
                - checkbox
              - generic [ref=e234]: 💬
              - generic [ref=e235]: 新对话 2026/7/29 19:02:59
              - button [ref=e237]:
                - img [ref=e238]
            - generic [ref=e240] [cursor=pointer]:
              - generic [ref=e242]:
                - checkbox
              - generic [ref=e244]: 💬
              - generic [ref=e245]: 新对话 2026/7/29 19:02:20
              - button [ref=e247]:
                - img [ref=e248]
            - generic [ref=e250] [cursor=pointer]:
              - generic [ref=e252]:
                - checkbox
              - generic [ref=e254]: 💬
              - generic [ref=e255]: 新对话 2026/7/29 18:56:36
              - button [ref=e257]:
                - img [ref=e258]
            - generic [ref=e260] [cursor=pointer]:
              - generic [ref=e262]:
                - checkbox
              - generic [ref=e264]: 💬
              - generic [ref=e265]: T+420 测试会话
              - button [ref=e267]:
                - img [ref=e268]
            - generic [ref=e270] [cursor=pointer]:
              - generic [ref=e272]:
                - checkbox
              - generic [ref=e274]: 💬
              - generic [ref=e275]: 新对话 2026/7/29 18:51:50
              - button [ref=e277]:
                - img [ref=e278]
            - generic [ref=e280] [cursor=pointer]:
              - generic [ref=e282]:
                - checkbox
              - generic [ref=e284]: 💬
              - generic [ref=e285]: 新对话 2026/7/29 18:51:44
              - button [ref=e287]:
                - img [ref=e288]
            - generic [ref=e290] [cursor=pointer]:
              - generic [ref=e292]:
                - checkbox
              - generic [ref=e294]: 💬
              - generic [ref=e295]: 新对话 2026/7/29 18:51:04
              - button [ref=e297]:
                - img [ref=e298]
            - generic [ref=e300] [cursor=pointer]:
              - generic [ref=e302]:
                - checkbox
              - generic [ref=e304]: 💬
              - generic [ref=e305]: 新对话 2026/7/29 18:49:13
              - button [ref=e307]:
                - img [ref=e308]
            - generic [ref=e310] [cursor=pointer]:
              - generic [ref=e312]:
                - checkbox
              - generic [ref=e314]: 💬
              - generic [ref=e315]: 新对话 2026/7/29 18:48:35
              - button [ref=e317]:
                - img [ref=e318]
            - generic [ref=e320] [cursor=pointer]:
              - generic [ref=e322]:
                - checkbox
              - generic [ref=e324]: 💬
              - generic [ref=e325]: 新对话 2026/7/29 18:47:56
              - button [ref=e327]:
                - img [ref=e328]
            - generic [ref=e330] [cursor=pointer]:
              - generic [ref=e332]:
                - checkbox
              - generic [ref=e334]: 💬
              - generic [ref=e335]: 新对话 2026/7/29 18:02:46
              - button [ref=e337]:
                - img [ref=e338]
            - generic [ref=e340] [cursor=pointer]:
              - generic [ref=e342]:
                - checkbox
              - generic [ref=e344]: 💬
              - generic [ref=e345]: 2+2=?
              - button [ref=e347]:
                - img [ref=e348]
            - generic [ref=e350] [cursor=pointer]:
              - generic [ref=e352]:
                - checkbox
              - generic [ref=e354]: 💬
              - generic [ref=e355]: hello?
              - button [ref=e357]:
                - img [ref=e358]
            - generic [ref=e360] [cursor=pointer]:
              - generic [ref=e362]:
                - checkbox
              - generic [ref=e364]: 💬
              - generic [ref=e365]: 新对话 2026/7/29 17:56:04
              - button [ref=e367]:
                - img [ref=e368]
            - generic [ref=e370] [cursor=pointer]:
              - generic [ref=e372]:
                - checkbox
              - generic [ref=e374]: 💬
              - generic [ref=e375]: 2+2=?
              - button [ref=e377]:
                - img [ref=e378]
            - generic [ref=e380] [cursor=pointer]:
              - generic [ref=e382]:
                - checkbox
              - generic [ref=e384]: 💬
              - generic [ref=e385]: hello?
              - button [ref=e387]:
                - img [ref=e388]
            - generic [ref=e390] [cursor=pointer]:
              - generic [ref=e392]:
                - checkbox
              - generic [ref=e394]: 💬
              - generic [ref=e395]: T+420 测试会话
              - button [ref=e397]:
                - img [ref=e398]
            - generic [ref=e400] [cursor=pointer]:
              - generic [ref=e402]:
                - checkbox
              - generic [ref=e404]: 💬
              - generic [ref=e405]: 1+1=? 简短回答
              - button [ref=e407]:
                - img [ref=e408]
            - generic [ref=e410] [cursor=pointer]:
              - generic [ref=e412]:
                - checkbox
              - generic [ref=e414]: 💬
              - generic [ref=e415]: 新对话 2026/7/29 17:47:47
              - button [ref=e417]:
                - img [ref=e418]
            - generic [ref=e420] [cursor=pointer]:
              - generic [ref=e422]:
                - checkbox
              - generic [ref=e424]: 💬
              - generic [ref=e425]: test blackhole
              - button [ref=e427]:
                - img [ref=e428]
            - generic [ref=e430] [cursor=pointer]:
              - generic [ref=e432]:
                - checkbox
              - generic [ref=e434]: 💬
              - generic [ref=e435]: 新对话 2026/7/29 17:43:32
              - button [ref=e437]:
                - img [ref=e438]
            - generic [ref=e440] [cursor=pointer]:
              - generic [ref=e442]:
                - checkbox
              - generic [ref=e444]: 💬
              - generic [ref=e445]: 2+2=?
              - button [ref=e447]:
                - img [ref=e448]
            - generic [ref=e450] [cursor=pointer]:
              - generic [ref=e452]:
                - checkbox
              - generic [ref=e454]: 💬
              - generic [ref=e455]: hello?
              - button [ref=e457]:
                - img [ref=e458]
            - generic [ref=e460] [cursor=pointer]:
              - generic [ref=e462]:
                - checkbox
              - generic [ref=e464]: 💬
              - generic [ref=e465]: 新对话 2026/7/29 17:37:32
              - button [ref=e467]:
                - img [ref=e468]
            - generic [ref=e470] [cursor=pointer]:
              - generic [ref=e472]:
                - checkbox
              - generic [ref=e474]: 💬
              - generic [ref=e475]: T+420 测试会话
              - button [ref=e477]:
                - img [ref=e478]
            - generic [ref=e480] [cursor=pointer]:
              - generic [ref=e482]:
                - checkbox
              - generic [ref=e484]: 💬
              - generic [ref=e485]: 1+1=? 简短回答
              - button [ref=e487]:
                - img [ref=e488]
            - generic [ref=e490] [cursor=pointer]:
              - generic [ref=e492]:
                - checkbox
              - generic [ref=e494]: 💬
              - generic [ref=e495]: 新对话 2026/7/29 17:33:15
              - button [ref=e497]:
                - img [ref=e498]
            - generic [ref=e500] [cursor=pointer]:
              - generic [ref=e502]:
                - checkbox
              - generic [ref=e504]: 💬
              - generic [ref=e505]: test blackhole
              - button [ref=e507]:
                - img [ref=e508]
            - generic [ref=e510] [cursor=pointer]:
              - generic [ref=e512]:
                - checkbox
              - generic [ref=e514]: 💬
              - generic [ref=e515]: 新对话 2026/7/29 17:29:01
              - button [ref=e517]:
                - img [ref=e518]
            - generic [ref=e520] [cursor=pointer]:
              - generic [ref=e522]:
                - checkbox
              - generic [ref=e524]: 💬
              - generic [ref=e525]: 2+2=?
              - button [ref=e527]:
                - img [ref=e528]
            - generic [ref=e530] [cursor=pointer]:
              - generic [ref=e532]:
                - checkbox
              - generic [ref=e534]: 💬
              - generic [ref=e535]: hello?
              - button [ref=e537]:
                - img [ref=e538]
            - generic [ref=e540] [cursor=pointer]:
              - generic [ref=e542]:
                - checkbox
              - generic [ref=e544]: 💬
              - generic [ref=e545]: 新对话 2026/7/29 17:22:55
              - button [ref=e547]:
                - img [ref=e548]
            - generic [ref=e550] [cursor=pointer]:
              - generic [ref=e552]:
                - checkbox
              - generic [ref=e554]: 💬
              - generic [ref=e555]: 新对话 2026/7/29 17:17:36
              - button [ref=e557]:
                - img [ref=e558]
            - generic [ref=e560] [cursor=pointer]:
              - generic [ref=e562]:
                - checkbox
              - generic [ref=e564]: 💬
              - generic [ref=e565]: 2+2=?
              - button [ref=e567]:
                - img [ref=e568]
            - generic [ref=e570] [cursor=pointer]:
              - generic [ref=e572]:
                - checkbox
              - generic [ref=e574]: 💬
              - generic [ref=e575]: hello?
              - button [ref=e577]:
                - img [ref=e578]
            - generic [ref=e580] [cursor=pointer]:
              - generic [ref=e582]:
                - checkbox
              - generic [ref=e584]: 💬
              - generic [ref=e585]: 新对话 2026/7/29 17:11:30
              - button [ref=e587]:
                - img [ref=e588]
            - generic [ref=e590] [cursor=pointer]:
              - generic [ref=e592]:
                - checkbox
              - generic [ref=e594]: 💬
              - generic [ref=e595]: T+420 测试会话
              - button [ref=e597]:
                - img [ref=e598]
            - generic [ref=e600] [cursor=pointer]:
              - generic [ref=e602]:
                - checkbox
              - generic [ref=e604]: 💬
              - generic [ref=e605]: 1+1=? 简短回答
              - button [ref=e607]:
                - img [ref=e608]
            - generic [ref=e610] [cursor=pointer]:
              - generic [ref=e612]:
                - checkbox
              - generic [ref=e614]: 💬
              - generic [ref=e615]: 新对话 2026/7/29 17:06:47
              - button [ref=e617]:
                - img [ref=e618]
            - generic [ref=e620] [cursor=pointer]:
              - generic [ref=e622]:
                - checkbox
              - generic [ref=e624]: 💬
              - generic [ref=e625]: test blackhole
              - button [ref=e627]:
                - img [ref=e628]
            - generic [ref=e630] [cursor=pointer]:
              - generic [ref=e632]:
                - checkbox
              - generic [ref=e634]: 💬
              - generic [ref=e635]: 新对话 2026/7/29 17:02:34
              - button [ref=e637]:
                - img [ref=e638]
            - generic [ref=e640] [cursor=pointer]:
              - generic [ref=e642]:
                - checkbox
              - generic [ref=e644]: 💬
              - generic [ref=e645]: 2+2=?
              - button [ref=e647]:
                - img [ref=e648]
            - generic [ref=e650] [cursor=pointer]:
              - generic [ref=e652]:
                - checkbox
              - generic [ref=e654]: 💬
              - generic [ref=e655]: hello?
              - button [ref=e657]:
                - img [ref=e658]
            - generic [ref=e660] [cursor=pointer]:
              - generic [ref=e662]:
                - checkbox
              - generic [ref=e664]: 💬
              - generic [ref=e665]: 新对话 2026/7/29 16:56:27
              - button [ref=e667]:
                - img [ref=e668]
            - generic [ref=e670] [cursor=pointer]:
              - generic [ref=e672]:
                - checkbox
              - generic [ref=e674]: 💬
              - generic [ref=e675]: T+420 测试会话
              - button [ref=e677]:
                - img [ref=e678]
            - generic [ref=e680] [cursor=pointer]:
              - generic [ref=e682]:
                - checkbox
              - generic [ref=e684]: 💬
              - generic [ref=e685]: 1+1=? 简短回答
              - button [ref=e687]:
                - img [ref=e688]
            - generic [ref=e690] [cursor=pointer]:
              - generic [ref=e692]:
                - checkbox
              - generic [ref=e694]: 💬
              - generic [ref=e695]: 新对话 2026/7/29 16:52:14
              - button [ref=e697]:
                - img [ref=e698]
            - generic [ref=e700] [cursor=pointer]:
              - generic [ref=e702]:
                - checkbox
              - generic [ref=e704]: 💬
              - generic [ref=e705]: test blackhole
              - button [ref=e707]:
                - img [ref=e708]
            - generic [ref=e710] [cursor=pointer]:
              - generic [ref=e712]:
                - checkbox
              - generic [ref=e714]: 💬
              - generic [ref=e715]: 新对话 2026/7/29 16:47:57
              - button [ref=e717]:
                - img [ref=e718]
            - generic [ref=e720] [cursor=pointer]:
              - generic [ref=e722]:
                - checkbox
              - generic [ref=e724]: 💬
              - generic [ref=e725]: 2+2=?
              - button [ref=e727]:
                - img [ref=e728]
            - generic [ref=e730] [cursor=pointer]:
              - generic [ref=e732]:
                - checkbox
              - generic [ref=e734]: 💬
              - generic [ref=e735]: hello?
              - button [ref=e737]:
                - img [ref=e738]
            - generic [ref=e740] [cursor=pointer]:
              - generic [ref=e742]:
                - checkbox
              - generic [ref=e744]: 💬
              - generic [ref=e745]: 新对话 2026/7/29 16:45:57
              - button [ref=e747]:
                - img [ref=e748]
            - generic [ref=e750] [cursor=pointer]:
              - generic [ref=e752]:
                - checkbox
              - generic [ref=e754]: 💬
              - generic [ref=e755]: 新对话 2026/7/29 16:45:56
              - button [ref=e757]:
                - img [ref=e758]
            - generic [ref=e760] [cursor=pointer]:
              - generic [ref=e762]:
                - checkbox
              - generic [ref=e764]: 💬
              - generic [ref=e765]: 新对话 2026/7/29 16:44:57
              - button [ref=e767]:
                - img [ref=e768]
            - generic [ref=e770] [cursor=pointer]:
              - generic [ref=e772]:
                - checkbox
              - generic [ref=e774]: 💬
              - generic [ref=e775]: 新对话 2026/7/29 16:42:25
              - button [ref=e777]:
                - img [ref=e778]
            - generic [ref=e780] [cursor=pointer]:
              - generic [ref=e782]:
                - checkbox
              - generic [ref=e784]: 💬
              - generic [ref=e785]: T+420 测试会话
              - button [ref=e787]:
                - img [ref=e788]
            - generic [ref=e790] [cursor=pointer]:
              - generic [ref=e792]:
                - checkbox
              - generic [ref=e794]: 💬
              - generic [ref=e795]: 1+1=? 简短回答
              - button [ref=e797]:
                - img [ref=e798]
            - generic [ref=e800] [cursor=pointer]:
              - generic [ref=e802]:
                - checkbox
              - generic [ref=e804]: 💬
              - generic [ref=e805]: 新对话 2026/7/29 16:37:58
              - button [ref=e807]:
                - img [ref=e808]
            - generic [ref=e810] [cursor=pointer]:
              - generic [ref=e812]:
                - checkbox
              - generic [ref=e814]: 💬
              - generic [ref=e815]: test blackhole
              - button [ref=e817]:
                - img [ref=e818]
            - generic [ref=e820] [cursor=pointer]:
              - generic [ref=e822]:
                - checkbox
              - generic [ref=e824]: 💬
              - generic [ref=e825]: 新对话 2026/7/29 16:33:39
              - button [ref=e827]:
                - img [ref=e828]
            - generic [ref=e830] [cursor=pointer]:
              - generic [ref=e832]:
                - checkbox
              - generic [ref=e834]: 💬
              - generic [ref=e835]: 2+2=?
              - button [ref=e837]:
                - img [ref=e838]
            - generic [ref=e840] [cursor=pointer]:
              - generic [ref=e842]:
                - checkbox
              - generic [ref=e844]: 💬
              - generic [ref=e845]: hello?
              - button [ref=e847]:
                - img [ref=e848]
            - generic [ref=e850] [cursor=pointer]:
              - generic [ref=e852]:
                - checkbox
              - generic [ref=e854]: 💬
              - generic [ref=e855]: 新对话 2026/7/29 16:27:29
              - button [ref=e857]:
                - img [ref=e858]
            - generic [ref=e860] [cursor=pointer]:
              - generic [ref=e862]:
                - checkbox
              - generic [ref=e864]: 💬
              - generic [ref=e865]: T+420 测试会话
              - button [ref=e867]:
                - img [ref=e868]
            - generic [ref=e870] [cursor=pointer]:
              - generic [ref=e872]:
                - checkbox
              - generic [ref=e874]: 💬
              - generic [ref=e875]: 1+1=? 简短回答
              - button [ref=e877]:
                - img [ref=e878]
            - generic [ref=e880] [cursor=pointer]:
              - generic [ref=e882]:
                - checkbox
              - generic [ref=e884]: 💬
              - generic [ref=e885]: 新对话 2026/7/29 16:22:31
              - button [ref=e887]:
                - img [ref=e888]
            - generic [ref=e890] [cursor=pointer]:
              - generic [ref=e892]:
                - checkbox
              - generic [ref=e894]: 💬
              - generic [ref=e895]: test blackhole
              - button [ref=e897]:
                - img [ref=e898]
            - generic [ref=e900] [cursor=pointer]:
              - generic [ref=e902]:
                - checkbox
              - generic [ref=e904]: 💬
              - generic [ref=e905]: 新对话 2026/7/29 16:18:15
              - button [ref=e907]:
                - img [ref=e908]
            - generic [ref=e910] [cursor=pointer]:
              - generic [ref=e912]:
                - checkbox
              - generic [ref=e914]: 💬
              - generic [ref=e915]: 2+2=?
              - button [ref=e917]:
                - img [ref=e918]
            - generic [ref=e920] [cursor=pointer]:
              - generic [ref=e922]:
                - checkbox
              - generic [ref=e924]: 💬
              - generic [ref=e925]: hello?
              - button [ref=e927]:
                - img [ref=e928]
            - generic [ref=e930] [cursor=pointer]:
              - generic [ref=e932]:
                - checkbox
              - generic [ref=e934]: 💬
              - generic [ref=e935]: 新对话 2026/7/29 16:12:08
              - button [ref=e937]:
                - img [ref=e938]
            - generic [ref=e940] [cursor=pointer]:
              - generic [ref=e942]:
                - checkbox
              - generic [ref=e944]: 💬
              - generic [ref=e945]: 1+1=? 简短回答
              - button [ref=e947]:
                - img [ref=e948]
            - generic [ref=e950] [cursor=pointer]:
              - generic [ref=e952]:
                - checkbox
              - generic [ref=e954]: 💬
              - generic [ref=e955]: 新对话 2026/7/28 18:08:10
              - button [ref=e957]:
                - img [ref=e958]
            - generic [ref=e960] [cursor=pointer]:
              - generic [ref=e962]:
                - checkbox
              - generic [ref=e964]: 💬
              - generic [ref=e965]: test blackhole
              - button [ref=e967]:
                - img [ref=e968]
            - generic [ref=e970] [cursor=pointer]:
              - generic [ref=e972]:
                - checkbox
              - generic [ref=e974]: 💬
              - generic [ref=e975]: 新对话 2026/7/28 18:02:34
              - button [ref=e977]:
                - img [ref=e978]
            - generic [ref=e980] [cursor=pointer]:
              - generic [ref=e982]:
                - checkbox
              - generic [ref=e984]: 💬
              - generic [ref=e985]: 2+2=?
              - button [ref=e987]:
                - img [ref=e988]
            - generic [ref=e990] [cursor=pointer]:
              - generic [ref=e992]:
                - checkbox
              - generic [ref=e994]: 💬
              - generic [ref=e995]: hello?
              - button [ref=e997]:
                - img [ref=e998]
            - generic [ref=e1000] [cursor=pointer]:
              - generic [ref=e1002]:
                - checkbox
              - generic [ref=e1004]: 💬
              - generic [ref=e1005]: 2+3=? 简短回答
              - button [ref=e1007]:
                - img [ref=e1008]
            - generic [ref=e1010] [cursor=pointer]:
              - generic [ref=e1012]:
                - checkbox
              - generic [ref=e1014]: 💬
              - generic [ref=e1015]: 2+3=? 简短回答
              - button [ref=e1017]:
                - img [ref=e1018]
            - generic [ref=e1020] [cursor=pointer]:
              - generic [ref=e1022]:
                - checkbox
              - generic [ref=e1024]: 💬
              - generic [ref=e1025]: 2+3=? 简短回答
              - button [ref=e1027]:
                - img [ref=e1028]
            - generic [ref=e1030] [cursor=pointer]:
              - generic [ref=e1032]:
                - checkbox
              - generic [ref=e1034]: 💬
              - generic [ref=e1035]: 2+3=? 简短回答
              - button [ref=e1037]:
                - img [ref=e1038]
            - generic [ref=e1040] [cursor=pointer]:
              - generic [ref=e1042]:
                - checkbox
              - generic [ref=e1044]: 💬
              - generic [ref=e1045]: 新对话 2026/7/24 17:11:25
              - button [ref=e1047]:
                - img [ref=e1048]
            - generic [ref=e1050] [cursor=pointer]:
              - generic [ref=e1052]:
                - checkbox
              - generic [ref=e1054]: 💬
              - generic [ref=e1055]: 2+3=? 简短回答
              - button [ref=e1057]:
                - img [ref=e1058]
            - generic [ref=e1060] [cursor=pointer]:
              - generic [ref=e1062]:
                - checkbox
              - generic [ref=e1064]: 💬
              - generic [ref=e1065]: 新对话 2026/7/24 17:08:01
              - button [ref=e1067]:
                - img [ref=e1068]
            - generic [ref=e1070] [cursor=pointer]:
              - generic [ref=e1072]:
                - checkbox
              - generic [ref=e1074]: 💬
              - generic [ref=e1075]: 新对话 2026/7/24 17:06:48
              - button [ref=e1077]:
                - img [ref=e1078]
            - generic [ref=e1080] [cursor=pointer]:
              - generic [ref=e1082]:
                - checkbox
              - generic [ref=e1084]: 💬
              - generic [ref=e1085]: 1+1=? 简短回答
              - button [ref=e1087]:
                - img [ref=e1088]
            - generic [ref=e1090] [cursor=pointer]:
              - generic [ref=e1092]:
                - checkbox
              - generic [ref=e1094]: 💬
              - generic [ref=e1095]: 新对话 2026/7/24 17:04:03
              - button [ref=e1097]:
                - img [ref=e1098]
            - generic [ref=e1100] [cursor=pointer]:
              - generic [ref=e1102]:
                - checkbox
              - generic [ref=e1104]: 💬
              - generic [ref=e1105]: test blackhole
              - button [ref=e1107]:
                - img [ref=e1108]
            - generic [ref=e1110] [cursor=pointer]:
              - generic [ref=e1112]:
                - checkbox
              - generic [ref=e1114]: 💬
              - generic [ref=e1115]: 1+1=? 简短回答
              - button [ref=e1117]:
                - img [ref=e1118]
            - generic [ref=e1120] [cursor=pointer]:
              - generic [ref=e1122]:
                - checkbox
              - generic [ref=e1124]: 💬
              - generic [ref=e1125]: 新对话 2026/7/24 17:01:15
              - button [ref=e1127]:
                - img [ref=e1128]
            - generic [ref=e1130] [cursor=pointer]:
              - generic [ref=e1132]:
                - checkbox
              - generic [ref=e1134]: 💬
              - generic [ref=e1135]: test blackhole
              - button [ref=e1137]:
                - img [ref=e1138]
            - generic [ref=e1140] [cursor=pointer]:
              - generic [ref=e1142]:
                - checkbox
              - generic [ref=e1144]: 💬
              - generic [ref=e1145]: 新对话 2026/7/24 16:59:26
              - button [ref=e1147]:
                - img [ref=e1148]
            - generic [ref=e1150] [cursor=pointer]:
              - generic [ref=e1152]:
                - checkbox
              - generic [ref=e1154]: 💬
              - generic [ref=e1155]: 新对话 2026/7/24 16:57:22
              - button [ref=e1157]:
                - img [ref=e1158]
            - generic [ref=e1160] [cursor=pointer]:
              - generic [ref=e1162]:
                - checkbox
              - generic [ref=e1164]: 💬
              - generic [ref=e1165]: 新对话 2026/7/24 16:55:45
              - button [ref=e1167]:
                - img [ref=e1168]
            - generic [ref=e1170] [cursor=pointer]:
              - generic [ref=e1172]:
                - checkbox
              - generic [ref=e1174]: 💬
              - generic [ref=e1175]: 1+1=? 简短回答
              - button [ref=e1177]:
                - img [ref=e1178]
            - generic [ref=e1180] [cursor=pointer]:
              - generic [ref=e1182]:
                - checkbox
              - generic [ref=e1184]: 💬
              - generic [ref=e1185]: 新对话 2026/7/24 16:51:49
              - button [ref=e1187]:
                - img [ref=e1188]
            - generic [ref=e1190] [cursor=pointer]:
              - generic [ref=e1192]:
                - checkbox
              - generic [ref=e1194]: 💬
              - generic [ref=e1195]: test blackhole
              - button [ref=e1197]:
                - img [ref=e1198]
            - generic [ref=e1200] [cursor=pointer]:
              - generic [ref=e1202]:
                - checkbox
              - generic [ref=e1204]: 💬
              - generic [ref=e1205]: 新对话 2026/7/24 16:27:16
              - button [ref=e1207]:
                - img [ref=e1208]
            - generic [ref=e1210] [cursor=pointer]:
              - generic [ref=e1212]:
                - checkbox
              - generic [ref=e1214]: 💬
              - generic [ref=e1215]: 2+2=?
              - button [ref=e1217]:
                - img [ref=e1218]
            - generic [ref=e1220] [cursor=pointer]:
              - generic [ref=e1222]:
                - checkbox
              - generic [ref=e1224]: 💬
              - generic [ref=e1225]: hello?
              - button [ref=e1227]:
                - img [ref=e1228]
            - generic [ref=e1230] [cursor=pointer]:
              - generic [ref=e1232]:
                - checkbox
              - generic [ref=e1234]: 💬
              - generic [ref=e1235]: hello?
              - button [ref=e1237]:
                - img [ref=e1238]
            - generic [ref=e1240] [cursor=pointer]:
              - generic [ref=e1242]:
                - checkbox
              - generic [ref=e1244]: 💬
              - generic [ref=e1245]: T+420 测试会话
              - button [ref=e1247]:
                - img [ref=e1248]
            - generic [ref=e1250] [cursor=pointer]:
              - generic [ref=e1252]:
                - checkbox
              - generic [ref=e1254]: 💬
              - generic [ref=e1255]: 新对话 2026/7/24 16:11:22
              - button [ref=e1257]:
                - img [ref=e1258]
            - generic [ref=e1260] [cursor=pointer]:
              - generic [ref=e1262]:
                - checkbox
              - generic [ref=e1264]: 💬
              - generic [ref=e1265]: 新对话 2026/7/24 16:11:19
              - button [ref=e1267]:
                - img [ref=e1268]
            - generic [ref=e1270] [cursor=pointer]:
              - generic [ref=e1272]:
                - checkbox
              - generic [ref=e1274]: 💬
              - generic [ref=e1275]: 新对话 2026/7/24 16:11:15
              - button [ref=e1277]:
                - img [ref=e1278]
            - generic [ref=e1280] [cursor=pointer]:
              - generic [ref=e1282]:
                - checkbox
              - generic [ref=e1284]: 💬
              - generic [ref=e1285]: 新对话 2026/7/24 16:11:12
              - button [ref=e1287]:
                - img [ref=e1288]
            - generic [ref=e1290] [cursor=pointer]:
              - generic [ref=e1292]:
                - checkbox
              - generic [ref=e1294]: 💬
              - generic [ref=e1295]: 1+1=? 只需回答数字
              - button [ref=e1297]:
                - img [ref=e1298]
            - generic [ref=e1300] [cursor=pointer]:
              - generic [ref=e1302]:
                - checkbox
              - generic [ref=e1304]: 💬
              - generic [ref=e1305]: T+420 测试会话
              - button [ref=e1307]:
                - img [ref=e1308]
            - generic [ref=e1310] [cursor=pointer]:
              - generic [ref=e1312]:
                - checkbox
              - generic [ref=e1314]: 💬
              - generic [ref=e1315]: T+420 测试会话
              - button [ref=e1317]:
                - img [ref=e1318]
            - generic [ref=e1320] [cursor=pointer]:
              - generic [ref=e1322]:
                - checkbox
              - generic [ref=e1324]: 💬
              - generic [ref=e1325]: T+420 测试会话
              - button [ref=e1327]:
                - img [ref=e1328]
            - generic [ref=e1330] [cursor=pointer]:
              - generic [ref=e1332]:
                - checkbox
              - generic [ref=e1334]: 💬
              - generic [ref=e1335]: T+420 测试会话
              - button [ref=e1337]:
                - img [ref=e1338]
            - generic [ref=e1340] [cursor=pointer]:
              - generic [ref=e1342]:
                - checkbox
              - generic [ref=e1344]: 💬
              - generic [ref=e1345]: T+420 测试会话
              - button [ref=e1347]:
                - img [ref=e1348]
            - generic [ref=e1350] [cursor=pointer]:
              - generic [ref=e1352]:
                - checkbox
              - generic [ref=e1354]: 💬
              - generic [ref=e1355]: T+420 测试会话
              - button [ref=e1357]:
                - img [ref=e1358]
            - generic [ref=e1360] [cursor=pointer]:
              - generic [ref=e1362]:
                - checkbox
              - generic [ref=e1364]: 💬
              - generic [ref=e1365]: 新对话 2026/7/24 15:41:02
              - button [ref=e1367]:
                - img [ref=e1368]
            - generic [ref=e1370] [cursor=pointer]:
              - generic [ref=e1372]:
                - checkbox
              - generic [ref=e1374]: 💬
              - generic [ref=e1375]: 新对话 2026/7/24 15:34:15
              - button [ref=e1377]:
                - img [ref=e1378]
            - generic [ref=e1380] [cursor=pointer]:
              - generic [ref=e1382]:
                - checkbox
              - generic [ref=e1384]: 💬
              - generic [ref=e1385]: 新对话 2026/7/24 15:34:11
              - button [ref=e1387]:
                - img [ref=e1388]
            - generic [ref=e1390] [cursor=pointer]:
              - generic [ref=e1392]:
                - checkbox
              - generic [ref=e1394]: 💬
              - generic [ref=e1395]: 新对话 2026/7/24 15:34:08
              - button [ref=e1397]:
                - img [ref=e1398]
            - generic [ref=e1400] [cursor=pointer]:
              - generic [ref=e1402]:
                - checkbox
              - generic [ref=e1404]: 💬
              - generic [ref=e1405]: 新对话 2026/7/24 15:34:05
              - button [ref=e1407]:
                - img [ref=e1408]
            - generic [ref=e1410] [cursor=pointer]:
              - generic [ref=e1412]:
                - checkbox
              - generic [ref=e1414]: 💬
              - generic [ref=e1415]: 1+1=? 只需回答数字
              - button [ref=e1417]:
                - img [ref=e1418]
            - generic [ref=e1420] [cursor=pointer]:
              - generic [ref=e1422]:
                - checkbox
              - generic [ref=e1424]: 💬
              - generic [ref=e1425]: 1+1=? 只需回答数字
              - button [ref=e1427]:
                - img [ref=e1428]
            - generic [ref=e1430] [cursor=pointer]:
              - generic [ref=e1432]:
                - checkbox
              - generic [ref=e1434]: 💬
              - generic [ref=e1435]: 新对话 2026/7/24 15:15:49
              - button [ref=e1437]:
                - img [ref=e1438]
            - generic [ref=e1440] [cursor=pointer]:
              - generic [ref=e1442]:
                - checkbox
              - generic [ref=e1444]: 💬
              - generic [ref=e1445]: 新对话 2026/7/24 15:15:46
              - button [ref=e1447]:
                - img [ref=e1448]
            - generic [ref=e1450] [cursor=pointer]:
              - generic [ref=e1452]:
                - checkbox
              - generic [ref=e1454]: 💬
              - generic [ref=e1455]: 新对话 2026/7/24 15:15:42
              - button [ref=e1457]:
                - img [ref=e1458]
            - generic [ref=e1460] [cursor=pointer]:
              - generic [ref=e1462]:
                - checkbox
              - generic [ref=e1464]: 💬
              - generic [ref=e1465]: 新对话 2026/7/24 15:15:39
              - button [ref=e1467]:
                - img [ref=e1468]
            - generic [ref=e1470] [cursor=pointer]:
              - generic [ref=e1472]:
                - checkbox
              - generic [ref=e1474]: 💬
              - generic [ref=e1475]: 新对话 2026/7/24 15:15:32
              - button [ref=e1477]:
                - img [ref=e1478]
            - generic [ref=e1480] [cursor=pointer]:
              - generic [ref=e1482]:
                - checkbox
              - generic [ref=e1484]: 💬
              - generic [ref=e1485]: 新对话 2026/7/24 15:14:12
              - button [ref=e1487]:
                - img [ref=e1488]
            - generic [ref=e1490] [cursor=pointer]:
              - generic [ref=e1492]:
                - checkbox
              - generic [ref=e1494]: 💬
              - generic [ref=e1495]: 新对话 2026/7/24 15:14:09
              - button [ref=e1497]:
                - img [ref=e1498]
            - generic [ref=e1500] [cursor=pointer]:
              - generic [ref=e1502]:
                - checkbox
              - generic [ref=e1504]: 💬
              - generic [ref=e1505]: 新对话 2026/7/24 15:14:06
              - button [ref=e1507]:
                - img [ref=e1508]
            - generic [ref=e1510] [cursor=pointer]:
              - generic [ref=e1512]:
                - checkbox
              - generic [ref=e1514]: 💬
              - generic [ref=e1515]: 新对话 2026/7/24 15:14:02
              - button [ref=e1517]:
                - img [ref=e1518]
            - generic [ref=e1520] [cursor=pointer]:
              - generic [ref=e1522]:
                - checkbox
              - generic [ref=e1524]: 💬
              - generic [ref=e1525]: 新对话 2026/7/24 15:11:54
              - button [ref=e1527]:
                - img [ref=e1528]
            - generic [ref=e1530] [cursor=pointer]:
              - generic [ref=e1532]:
                - checkbox
              - generic [ref=e1534]: 💬
              - generic [ref=e1535]: 新对话 2026/7/24 15:11:20
              - button [ref=e1537]:
                - img [ref=e1538]
            - generic [ref=e1540] [cursor=pointer]:
              - generic [ref=e1542]:
                - checkbox
              - generic [ref=e1544]: 💬
              - generic [ref=e1545]: 新对话 2026/7/24 15:11:17
              - button [ref=e1547]:
                - img [ref=e1548]
            - generic [ref=e1550] [cursor=pointer]:
              - generic [ref=e1552]:
                - checkbox
              - generic [ref=e1554]: 💬
              - generic [ref=e1555]: 新对话 2026/7/24 15:11:14
              - button [ref=e1557]:
                - img [ref=e1558]
            - generic [ref=e1560] [cursor=pointer]:
              - generic [ref=e1562]:
                - checkbox
              - generic [ref=e1564]: 💬
              - generic [ref=e1565]: 新对话 2026/7/24 15:07:00
              - button [ref=e1567]:
                - img [ref=e1568]
            - generic [ref=e1570] [cursor=pointer]:
              - generic [ref=e1572]:
                - checkbox
              - generic [ref=e1574]: 💬
              - generic [ref=e1575]: 新对话 2026/7/24 15:06:26
              - button [ref=e1577]:
                - img [ref=e1578]
            - generic [ref=e1580] [cursor=pointer]:
              - generic [ref=e1582]:
                - checkbox
              - generic [ref=e1584]: 💬
              - generic [ref=e1585]: 新对话 2026/7/24 15:06:22
              - button [ref=e1587]:
                - img [ref=e1588]
            - generic [ref=e1590] [cursor=pointer]:
              - generic [ref=e1592]:
                - checkbox
              - generic [ref=e1594]: 💬
              - generic [ref=e1595]: 新对话 2026/7/24 15:06:19
              - button [ref=e1597]:
                - img [ref=e1598]
            - generic [ref=e1600] [cursor=pointer]:
              - generic [ref=e1602]:
                - checkbox
              - generic [ref=e1604]: 💬
              - generic [ref=e1605]: 新对话 2026/7/24 15:01:53
              - button [ref=e1607]:
                - img [ref=e1608]
            - generic [ref=e1610] [cursor=pointer]:
              - generic [ref=e1612]:
                - checkbox
              - generic [ref=e1614]: 💬
              - generic [ref=e1615]: 新对话 2026/7/24 15:01:32
              - button [ref=e1617]:
                - img [ref=e1618]
            - generic [ref=e1620] [cursor=pointer]:
              - generic [ref=e1622]:
                - checkbox
              - generic [ref=e1624]: 💬
              - generic [ref=e1625]: 新对话 2026/7/24 14:58:51
              - button [ref=e1627]:
                - img [ref=e1628]
            - generic [ref=e1630] [cursor=pointer]:
              - generic [ref=e1632]:
                - checkbox
              - generic [ref=e1634]: 💬
              - generic [ref=e1635]: 新对话 2026/7/24 14:58:25
              - button [ref=e1637]:
                - img [ref=e1638]
            - generic [ref=e1640] [cursor=pointer]:
              - generic [ref=e1642]:
                - checkbox
              - generic [ref=e1644]: 💬
              - generic [ref=e1645]: 新对话 2026/7/24 14:57:17
              - button [ref=e1647]:
                - img [ref=e1648]
            - generic [ref=e1650] [cursor=pointer]:
              - generic [ref=e1652]:
                - checkbox
              - generic [ref=e1654]: 💬
              - generic [ref=e1655]: 新对话 2026/7/24 14:56:50
              - button [ref=e1657]:
                - img [ref=e1658]
            - generic [ref=e1660] [cursor=pointer]:
              - generic [ref=e1662]:
                - checkbox
              - generic [ref=e1664]: 💬
              - generic [ref=e1665]: 新对话 2026/7/24 14:56:28
              - button [ref=e1667]:
                - img [ref=e1668]
            - generic [ref=e1670] [cursor=pointer]:
              - generic [ref=e1672]:
                - checkbox
              - generic [ref=e1674]: 💬
              - generic [ref=e1675]: 新对话 2026/7/24 14:56:02
              - button [ref=e1677]:
                - img [ref=e1678]
            - generic [ref=e1680] [cursor=pointer]:
              - generic [ref=e1682]:
                - checkbox
              - generic [ref=e1684]: 💬
              - generic [ref=e1685]: 新对话 2026/7/24 14:53:55
              - button [ref=e1687]:
                - img [ref=e1688]
            - generic [ref=e1690] [cursor=pointer]:
              - generic [ref=e1692]:
                - checkbox
              - generic [ref=e1694]: 💬
              - generic [ref=e1695]: 新对话 2026/7/24 14:52:59
              - button [ref=e1697]:
                - img [ref=e1698]
            - generic [ref=e1700] [cursor=pointer]:
              - generic [ref=e1702]:
                - checkbox
              - generic [ref=e1704]: 💬
              - generic [ref=e1705]: 新对话 2026/7/23 17:29:14
              - button [ref=e1707]:
                - img [ref=e1708]
            - generic [ref=e1710] [cursor=pointer]:
              - generic [ref=e1712]:
                - checkbox
              - generic [ref=e1714]: 💬
              - generic [ref=e1715]: 新对话 2026/7/23 17:28:48
              - button [ref=e1717]:
                - img [ref=e1718]
            - generic [ref=e1720] [cursor=pointer]:
              - generic [ref=e1722]:
                - checkbox
              - generic [ref=e1724]: 💬
              - generic [ref=e1725]: 新对话 2026/7/23 16:51:25
              - button [ref=e1727]:
                - img [ref=e1728]
            - generic [ref=e1730] [cursor=pointer]:
              - generic [ref=e1732]:
                - checkbox
              - generic [ref=e1734]: 💬
              - generic [ref=e1735]: 新对话 2026/7/23 16:50:59
              - button [ref=e1737]:
                - img [ref=e1738]
            - generic [ref=e1740] [cursor=pointer]:
              - generic [ref=e1742]:
                - checkbox
              - generic [ref=e1744]: 💬
              - generic [ref=e1745]: 新对话 2026/7/23 16:31:10
              - button [ref=e1747]:
                - img [ref=e1748]
            - generic [ref=e1750] [cursor=pointer]:
              - generic [ref=e1752]:
                - checkbox
              - generic [ref=e1754]: 💬
              - generic [ref=e1755]: 新对话 2026/7/23 16:27:02
              - button [ref=e1757]:
                - img [ref=e1758]
            - generic [ref=e1760] [cursor=pointer]:
              - generic [ref=e1762]:
                - checkbox
              - generic [ref=e1764]: 💬
              - generic [ref=e1765]: 新对话 2026/7/23 16:24:34
              - button [ref=e1767]:
                - img [ref=e1768]
            - generic [ref=e1770] [cursor=pointer]:
              - generic [ref=e1772]:
                - checkbox
              - generic [ref=e1774]: 💬
              - generic [ref=e1775]: 新对话 2026/7/23 16:24:25
              - button [ref=e1777]:
                - img [ref=e1778]
            - generic [ref=e1780] [cursor=pointer]:
              - generic [ref=e1782]:
                - checkbox
              - generic [ref=e1784]: 💬
              - generic [ref=e1785]: 新对话 2026/7/23 15:37:49
              - button [ref=e1787]:
                - img [ref=e1788]
            - generic [ref=e1790] [cursor=pointer]:
              - generic [ref=e1792]:
                - checkbox
              - generic [ref=e1794]: 💬
              - generic [ref=e1795]: 新对话 2026/7/23 15:37:24
              - button [ref=e1797]:
                - img [ref=e1798]
            - generic [ref=e1800] [cursor=pointer]:
              - generic [ref=e1802]:
                - checkbox
              - generic [ref=e1804]: 💬
              - generic [ref=e1805]: 新对话 2026/7/23 15:36:45
              - button [ref=e1807]:
                - img [ref=e1808]
            - generic [ref=e1810] [cursor=pointer]:
              - generic [ref=e1812]:
                - checkbox
              - generic [ref=e1814]: 💬
              - generic [ref=e1815]: 新对话 2026/7/23 15:36:20
              - button [ref=e1817]:
                - img [ref=e1818]
            - generic [ref=e1820] [cursor=pointer]:
              - generic [ref=e1822]:
                - checkbox
              - generic [ref=e1824]: 💬
              - generic [ref=e1825]: 新对话 2026/7/23 15:28:54
              - button [ref=e1827]:
                - img [ref=e1828]
            - generic [ref=e1830] [cursor=pointer]:
              - generic [ref=e1832]:
                - checkbox
              - generic [ref=e1834]: 💬
              - generic [ref=e1835]: 新对话 2026/7/23 15:28:28
              - button [ref=e1837]:
                - img [ref=e1838]
            - generic [ref=e1840] [cursor=pointer]:
              - generic [ref=e1842]:
                - checkbox
              - generic [ref=e1844]: 💬
              - generic [ref=e1845]: 新对话 2026/7/23 15:27:41
              - button [ref=e1847]:
                - img [ref=e1848]
            - generic [ref=e1850] [cursor=pointer]:
              - generic [ref=e1852]:
                - checkbox
              - generic [ref=e1854]: 💬
              - generic [ref=e1855]: 新对话 2026/7/23 15:27:15
              - button [ref=e1857]:
                - img [ref=e1858]
            - generic [ref=e1860] [cursor=pointer]:
              - generic [ref=e1862]:
                - checkbox
              - generic [ref=e1864]: 💬
              - generic [ref=e1865]: 新对话 2026/7/23 15:26:51
              - button [ref=e1867]:
                - img [ref=e1868]
            - generic [ref=e1870] [cursor=pointer]:
              - generic [ref=e1872]:
                - checkbox
              - generic [ref=e1874]: 💬
              - generic [ref=e1875]: 新对话 2026/7/23 15:25:05
              - button [ref=e1877]:
                - img [ref=e1878]
            - generic [ref=e1880] [cursor=pointer]:
              - generic [ref=e1882]:
                - checkbox
              - generic [ref=e1884]: 💬
              - generic [ref=e1885]: 新对话 2026/6/11 10:32:11
              - button [ref=e1887]:
                - img [ref=e1888]
            - generic [ref=e1890] [cursor=pointer]:
              - generic [ref=e1892]:
                - checkbox
              - generic [ref=e1894]: 💬
              - generic [ref=e1895]: 新对话 2026/5/27 08:55:45
              - button [ref=e1897]:
                - img [ref=e1898]
            - generic [ref=e1900] [cursor=pointer]:
              - generic [ref=e1902]:
                - checkbox
              - generic [ref=e1904]: 💬
              - generic [ref=e1905]: 新对话 2026/5/27 08:54:42
              - button [ref=e1907]:
                - img [ref=e1908]
        - generic [ref=e1911]:
          - generic [ref=e1913]:
            - generic [ref=e1914]: 新对话 2026/7/30 08:38:31
            - generic [ref=e1916]: fake-model
          - generic [ref=e1918]:
            - generic [ref=e1919]:
              - generic [ref=e1921] [cursor=pointer]:
                - generic:
                  - combobox [ref=e1923]
                  - generic [ref=e1924]: Bad Port (T+480 ER1)
                - img [ref=e1927]
              - generic [ref=e1930] [cursor=pointer]:
                - generic:
                  - combobox [ref=e1932]
                  - generic [ref=e1933]: fake-model
                - img [ref=e1936]
            - generic [ref=e1938]:
              - textbox "输入消息... (Shift+Enter 换行，Enter 发送)" [active] [ref=e1940]: hello?
              - button "发送" [ref=e1942] [cursor=pointer]:
                - generic [ref=e1943]:
                  - img [ref=e1945]
                  - text: 发送
  - button "命令 ⌘K" [ref=e1947] [cursor=pointer]:
    - img [ref=e1949]
    - generic [ref=e1951]: 命令
    - generic [ref=e1952]: ⌘K
```

# Test source

```ts
  1   | import { test, expect, shouldRunElectronE2E } from './helpers/electron-app'
  2   | 
  3   | /**
  4   |  * T+480: 错误处理 / 降级 UX 真用户测试
  5   |  *
  6   |  * 真实场景:用户配错模型(端口/模型名)→ 发消息 → 看 UI 怎么表现:
  7   |  * ER1: 错误端口 (11435) → send → assistant bubble 显示错误 + toast
  8   |  * ER2: 不存在模型 (qwen99-fake) → send → 错误
  9   |  * ER3: 错误后切换正确 provider → 可恢复
  10  |  * ER4: assistant bubble 状态显示 error (not stuck streaming)
  11  |  * ER5: 输入框被清空(用户可继续输入)
  12  |  */
  13  | 
  14  | test.describe('T+480 Chat 错误处理 / 降级 UX', () => {
  15  |   test.skip(!shouldRunElectronE2E, 'requires E2E_ELECTRON=1')
  16  | 
  17  |   async function setupConversation(window: any) {
  18  |     await window.waitForSelector('#app', { timeout: 10_000 })
  19  |     await window.waitForTimeout(800)
  20  |     await window.click('a.nav-item[href$="#/chat"]').catch(() => {})
  21  |     await window.waitForTimeout(1500)
  22  |     // 强制新建会话,避免 state 不干净
  23  |     const newChatBtn = window.locator('button.new-chat-btn, .empty-new-chat').first()
  24  |     if (await newChatBtn.count() > 0) {
  25  |       await newChatBtn.click()
  26  |       await window.waitForTimeout(1000)
  27  |     }
  28  |   }
  29  | 
  30  |   test('ER1: 错误端口 (11435) → send → assistant bubble 显示错误', async ({ window }) => {
  31  |     // 注入一个错误端口的 provider
  32  |     const addResult = await window.evaluate(async () => {
  33  |       const api = (window as any).electronAPI
  34  |       // 清旧
  35  |       const listRes = await api.models.list()
  36  |       if (listRes?.success && listRes.data) {
  37  |         for (const p of listRes.data) {
  38  |           if (p.name === 'Bad Port (T+480 ER1)') {
  39  |             await api.models.delete(p.id)
  40  |           }
  41  |         }
  42  |       }
  43  |       const r = await api.models.add({
  44  |         name: 'Bad Port (T+480 ER1)',
  45  |         type: 'openai',
  46  |         baseUrl: 'http://localhost:11435/v1', // 错误端口
  47  |         apiKey: 'no-key',
  48  |         enabled: true,
  49  |         timeout: 5_000, // 5s 超时,测试更快
  50  |         models: [{ id: 'fake-model', name: 'fake-model', capabilities: ['chat'] }]
  51  |       })
  52  |       return r?.success
  53  |     })
  54  |     expect(addResult).toBe(true)
  55  |     await window.waitForTimeout(500)
  56  | 
  57  |     await setupConversation(window)
  58  | 
  59  |     // 选 Bad Port provider
  60  |     const providerSelect = window.locator('.model-selector .el-select').first()
  61  |     if (await providerSelect.count() > 0) {
  62  |       await providerSelect.click()
  63  |       await window.waitForTimeout(500)
  64  |       const opt = window.locator('.el-select-dropdown__item:has-text("Bad Port (T+480 ER1)")').first()
  65  |       if (await opt.count() > 0) {
  66  |         await opt.click()
  67  |         await window.waitForTimeout(800)
  68  |       }
  69  |     }
  70  | 
  71  |     // 选 model
  72  |     const modelSelect = window.locator('.model-selector .el-select').nth(1)
  73  |     if (await modelSelect.count() > 0) {
  74  |       await window.waitForFunction(() => {
  75  |         const sels = document.querySelectorAll('.model-selector .el-select')
  76  |         return sels[1] && !sels[1].querySelector('input[disabled]')
  77  |       }, { timeout: 10_000 }).catch(() => {})
  78  |       await modelSelect.click()
  79  |       await window.waitForTimeout(500)
  80  |       const opt = window.locator('.el-select-dropdown__item:has-text("fake-model")').first()
  81  |       if (await opt.count() > 0) {
  82  |         await opt.click()
  83  |         await window.waitForTimeout(500)
  84  |       }
  85  |     }
  86  | 
  87  |     // 发消息
  88  |     const textarea = window.locator('.input-area textarea').first()
  89  |     await textarea.click()
  90  |     await textarea.fill('hello?')
  91  |     const sendBtn = window.locator('.input-area button:has-text("发送"), .input-area button:has-text("Send")').first()
  92  |     if (await sendBtn.count() > 0) {
> 93  |       await sendBtn.click()
      |                     ^ TimeoutError: locator.click: Timeout 30000ms exceeded.
  94  |     } else {
  95  |       await textarea.press('Enter')
  96  |     }
  97  | 
  98  |     // 等 assistant bubble 出现,带错误状态
  99  |     // 错误通常是 ECONNREFUSED 或 timeout
  100 |     await window.waitForFunction(() => {
  101 |       const bubbles = document.querySelectorAll('.message.assistant, .assistant-message, [class*="message"][class*="assistant"]')
  102 |       for (const b of Array.from(bubbles)) {
  103 |         const text = (b.textContent ?? '').toLowerCase()
  104 |         if (text.includes('error') || text.includes('错误') || text.includes('connect') || text.includes('timeout') || text.includes('econnrefused')) {
  105 |           return true
  106 |         }
  107 |       }
  108 |       return false
  109 |     }, { timeout: 30_000 })
  110 | 
  111 |     // 验证 toast 或 .el-message--error 也出现
  112 |     const errorMsg = await window.locator('.el-message--error').count()
  113 |     expect(errorMsg).toBeGreaterThan(0)
  114 |   })
  115 | 
  116 |   test('ER2: 错误后切回正确 Ollama provider → 可继续发消息', async ({ window }) => {
  117 |     // 确保 Bad Port provider + 好 Ollama 都存在
  118 |     await window.evaluate(async () => {
  119 |       const api = (window as any).electronAPI
  120 |       // 注入好 Ollama
  121 |       const listRes = await api.models.list()
  122 |       if (listRes?.success && listRes.data) {
  123 |         for (const p of listRes.data) {
  124 |           if (p.name === 'Good Ollama (T+480 ER2)') {
  125 |             await api.models.delete(p.id)
  126 |           }
  127 |         }
  128 |       }
  129 |       await api.models.add({
  130 |         name: 'Good Ollama (T+480 ER2)',
  131 |         type: 'openai',
  132 |         baseUrl: 'http://localhost:11434/v1',
  133 |         apiKey: 'no-key',
  134 |         enabled: true,
  135 |         timeout: 30_000,
  136 |         models: [{ id: 'qwen3.5:9b', name: 'qwen3.5:9b', capabilities: ['chat'] }]
  137 |       })
  138 |     })
  139 |     await window.waitForTimeout(500)
  140 | 
  141 |     await setupConversation(window)
  142 | 
  143 |     // 选 Good Ollama
  144 |     const providerSelect = window.locator('.model-selector .el-select').first()
  145 |     if (await providerSelect.count() > 0) {
  146 |       await providerSelect.click()
  147 |       await window.waitForTimeout(500)
  148 |       const opt = window.locator('.el-select-dropdown__item:has-text("Good Ollama (T+480 ER2)")').first()
  149 |       if (await opt.count() > 0) {
  150 |         await opt.click()
  151 |         await window.waitForTimeout(800)
  152 |       }
  153 |     }
  154 | 
  155 |     // 选 qwen3.5:9b
  156 |     const modelSelect = window.locator('.model-selector .el-select').nth(1)
  157 |     if (await modelSelect.count() > 0) {
  158 |       await window.waitForFunction(() => {
  159 |         const sels = document.querySelectorAll('.model-selector .el-select')
  160 |         return sels[1] && !sels[1].querySelector('input[disabled]')
  161 |       }, { timeout: 10_000 }).catch(() => {})
  162 |       await modelSelect.click()
  163 |       await window.waitForTimeout(500)
  164 |       const opt = window.locator('.el-select-dropdown__item:has-text("qwen3.5:9b")').first()
  165 |       if (await opt.count() > 0) {
  166 |         await opt.click()
  167 |         await window.waitForTimeout(500)
  168 |       }
  169 |     }
  170 | 
  171 |     // 发消息
  172 |     const textarea = window.locator('.input-area textarea').first()
  173 |     await textarea.click()
  174 |     await textarea.fill('2+2=?')
  175 |     const sendBtn = window.locator('.input-area button:has-text("发送"), .input-area button:has-text("Send")').first()
  176 |     if (await sendBtn.count() > 0) {
  177 |       await sendBtn.click()
  178 |     } else {
  179 |       await textarea.press('Enter')
  180 |     }
  181 | 
  182 |     // 等回复包含 4
  183 |     await window.waitForFunction(() => {
  184 |       const bubbles = document.querySelectorAll('.message.assistant, .assistant-message, [class*="message"][class*="assistant"]')
  185 |       for (const b of Array.from(bubbles)) {
  186 |         const text = b.textContent ?? ''
  187 |         if (text.includes('4') && text.length > 3) return true
  188 |       }
  189 |       return false
  190 |     }, { timeout: 60_000 })
  191 |   })
  192 | 
  193 |   test('ER3: 错误后 textarea 可继续输入(不卡死)', async ({ window }) => {
```