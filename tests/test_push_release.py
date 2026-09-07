"""离线验证 push 发布不生成文档、不改版本、不执行真实发布。"""
import subprocess
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


class PushReleaseTest(unittest.TestCase):
    def test_release_only(self):
        source = (ROOT / 'create/publish.sh').read_text()
        definitions, main = source.split('while [[ $# -gt 0 ]]; do', 1)
        # 替换外部动作，保留真实参数解析和执行顺序。
        mocks = '''
trap - EXIT
require_bin() { :; }
run_reference_sync() { echo unexpected-sync; }
bump_versions_if_openapi_changed() { echo unexpected-bump; }
run_verification() { echo verified; }
publish_npm() { echo npm-checked; }
publish_clawhub() { echo clawhub-checked; }
commit_and_push_release() { [[ "$RUN_GIT_PUSH" == false ]]; }
'''
        result = subprocess.run(
            ['bash', '-c', definitions + mocks + 'while [[ $# -gt 0 ]]; do' + main,
             'release-test', '--release-only'],
            cwd=ROOT, text=True, capture_output=True, check=True,
        )
        self.assertNotIn('unexpected-', result.stdout)
        self.assertIn('verified\nnpm-checked\nclawhub-checked', result.stdout)

    def test_workflow_routing(self):
        workflow = (ROOT / '.github/workflows/update-references.yml').read_text()
        self.assertIn('  push:\n    branches:\n      - main\n', workflow)
        self.assertIn("if: github.event_name == 'push'", workflow)
        self.assertIn("if: github.event_name != 'push'", workflow)
        self.assertIn('publish.sh --release-only', workflow)
        clawhub = (ROOT / '.github/workflows/publish-to-clawhub.yml').read_text()
        self.assertNotIn('  push:', clawhub)
        for text in (workflow, clawhub):
            self.assertIn('group: investoday-finance-data-release', text)
            self.assertIn('cancel-in-progress: false', text)


if __name__ == '__main__':
    unittest.main()
