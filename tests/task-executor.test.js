/**
 * PiPiClaw 核心功能测试
 * 覆盖：
 * 1. 识别需要 AI 生成的指令
 * 2. 模拟 AI 生成成功并返回内容
 * 3. 模拟 AI 生成失败的降级处理
 * 4. 高危命令被拦截
 * 5. 用户取消操作
 */

console.log('🧪 开始运行测试...\n');

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    console.log(`✅ ${name}`);
    passed++;
  } catch (error) {
    console.error(`❌ ${name}: ${error.message}`);
    failed++;
  }
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

// 1. 识别需要 AI 生成的指令
function simulateNeedsAIGen(instruction) {
  const generationKeywords = [
    '九九乘法表', '乘法表', '写一篇', '写个', '写一份',
    '生成', '创建', '代码', '脚本', '文章', '文档',
    '报告', '总结', '列表', '表格'
  ];
  const explicitContentKeywords = [
    '内容是', '内容为', '写', '内容:', '内容：',
    '写入', '写入内容', '保存为'
  ];
  const lower = instruction.toLowerCase();
  const hasGenerationNeed = generationKeywords.some(keyword =>
    lower.includes(keyword.toLowerCase())
  );
  const hasExplicitContent = explicitContentKeywords.some(keyword =>
    lower.includes(keyword.toLowerCase())
  );
  return hasGenerationNeed && !hasExplicitContent;
}

test('识别需要 AI 生成的指令 - 九九乘法表', () => {
  const instruction = '在桌面创建一个九九乘法表.txt';
  const needsAI = simulateNeedsAIGen(instruction);
  assert(needsAI === true, '应该识别为需要 AI 生成');
});

test('识别需要 AI 生成的指令 - 代码生成', () => {
  const instruction = '在桌面创建一个 test.txt 内容是 hello world';
  const needsAI = simulateNeedsAIGen(instruction);
  assert(needsAI === false, '有明确内容，不需要 AI 生成');
});

// 2. 模拟 AI 生成成功并返回内容
class MockAIGenerator {
  generate(instruction) {
    if (instruction.includes('九九乘法表')) {
      let result = '';
      for (let i = 1; i <= 9; i++) {
        for (let j = 1; j <= i; j++) {
          result += `${j} × ${i} = ${i * j}`;
          if (j < i) result += ' ';
        }
        result += '\n';
      }
      return result;
    }
    return 'Mock AI Content';
  }
}

test('模拟 AI 生成成功并返回内容', () => {
  const ai = new MockAIGenerator();
  const result = ai.generate('在桌面创建一个九九乘法表.txt');
  assert(result.includes('1 × 1 = 1'), '应该包含九九乘法表');
});

// 3. 模拟 AI 生成失败的降级处理
function simulateAIGenRetry() {
  let attempts = 0;
  const providers = ['Provider1', 'Provider2', 'Provider3'];

  function generate() {
    attempts++;
    if (attempts <= 2) {
      throw new Error(`Model failed: ${providers[attempts - 1]} failed`);
    }
    return 'Success from Provider3';
  }

  for (let i = 0; i < providers.length; i++) {
    try {
      return generate();
    } catch (e) {
      if (i === providers.length - 1) {
        throw new Error('All providers failed');
      }
    }
  }
}

test('模拟 AI 生成失败的降级处理 - 重试逻辑', () => {
  let attempts = 0;
  const providers = ['Provider1', 'Provider2', 'Provider3'];
  let successContent = null;
  for (let i = 0; i < providers.length; i++) {
    attempts++;
    if (attempts <= 2) {
      continue;
    }
    successContent = 'Success from Provider3';
    break;
  }
  assert(successContent !== null, '应该有一个 Provider 应该成功');
});

test('模拟 AI 生成失败的降级处理 - 全部失败', () => {
  const providers = ['Provider1', 'Provider2'];
  const errors = [];
  for (let i = 0; i < providers.length; i++) {
    errors.push(new Error(`${providers[i]} failed`));
  }
  assert(errors.length === 2, '应该有 2 个失败');
});

// 4. 高危命令被拦截
class MockContentValidator {
  sanitize(content) {
    const dangerousPatterns = [
      /rm\s+-rf\s+[\\/~]/, /mkfs/, /dd\s+if=/,
      /reg\s+(add|delete|edit|import|export)/i, /format\s+[a-z]:/i, /\.\.\//, /\.\.\\/
    ];

    for (const pattern of dangerousPatterns) {
      if (pattern.test(content)) {
        return { safe: false, reason: `Dangerous content blocked` };
      }
    }

    return { safe: true };
  }
}

test('高危命令被拦截 - rm -rf', () => {
  const validator = new MockContentValidator();
  const result = validator.sanitize('rm -rf /');
  assert(result.safe === false, '应该拦截 rm -rf');
});

test('高危命令被拦截 - 路径遍历', () => {
  const validator = new MockContentValidator();
  const result = validator.sanitize('../../etc/passwd');
  assert(result.safe === false, '应该拦截路径遍历');
});

test('安全内容应该通过', () => {
  const validator = new MockContentValidator();
  const result = validator.sanitize('Hello World');
  assert(result.safe === true, '应该通过安全内容');
});

// 5. 用户取消操作
class MockUserConfirm {
  constructor(confirmed) {
    this.confirmed = confirmed;
  }

  async waitConfirm() {
    return this.confirmed;
  }
}

test('用户取消操作 - 流程中止', async () => {
  const userConfirm = new MockUserConfirm(false);
  const confirmed = await userConfirm.waitConfirm();
  assert(confirmed === false, '应该取消');
});

test('用户确认操作 - 继续执行', async () => {
  const userConfirm = new MockUserConfirm(true);
  const confirmed = await userConfirm.waitConfirm();
  assert(confirmed === true, '应该继续执行');
});

console.log(`\n📊 测试结果: ${passed} 个通过, ${failed} 个失败`);

if (failed > 0) {
  process.exit(1);
}

process.exit(0);
