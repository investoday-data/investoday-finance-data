import importlib.util
from pathlib import Path
import unittest


MODULE_PATH = Path(__file__).resolve().parents[1] / "scripts" / "validate-update-manifest.py"
SPEC = importlib.util.spec_from_file_location("validate_update_manifest", MODULE_PATH)
MODULE = importlib.util.module_from_spec(SPEC)
assert SPEC.loader is not None
SPEC.loader.exec_module(MODULE)


class UpdateManifestClientsTests(unittest.TestCase):
    def test_fixed_paths_object_and_discovery_paths_array_are_valid(self):
        MODULE.validate_clients(
            [
                {
                    "id": "skills-manager",
                    "name": "Skills Manager",
                    "targets": [
                        {
                            "type": "fixed",
                            "paths": {
                                "skills-manager": "$HOME/.skills-manager/skills",
                                "cursor": "$HOME/.cursor/skills",
                            },
                        },
                        {
                            "type": "discovery",
                            "paths": [
                                "$HOME/.openclaw/workspace*/skills",
                            ],
                        },
                    ],
                }
            ]
        )

    def test_fixed_paths_array_is_invalid(self):
        with self.assertRaises(SystemExit) as context:
            MODULE.validate_clients(
                [
                    {
                        "id": "skills-manager",
                        "name": "Skills Manager",
                        "targets": [
                            {
                                "type": "fixed",
                                "paths": ["$HOME/.skills-manager/skills"],
                            }
                        ],
                    }
                ]
            )

        self.assertIn("fixed target paths must be a non-empty object", str(context.exception))

    def test_fixed_path_code_must_be_kebab_case(self):
        with self.assertRaises(SystemExit) as context:
            MODULE.validate_clients(
                [
                    {
                        "id": "skills-manager",
                        "name": "Skills Manager",
                        "targets": [
                            {
                                "type": "fixed",
                                "paths": {
                                    "Cursor Skills": "$HOME/.cursor/skills",
                                },
                            }
                        ],
                    }
                ]
            )

        self.assertIn("fixed target path code is invalid", str(context.exception))

    def test_fixed_path_value_must_start_with_home(self):
        with self.assertRaises(SystemExit) as context:
            MODULE.validate_clients(
                [
                    {
                        "id": "skills-manager",
                        "name": "Skills Manager",
                        "targets": [
                            {
                                "type": "fixed",
                                "paths": {
                                    "cursor": "/tmp/.cursor/skills",
                                },
                            }
                        ],
                    }
                ]
            )

        self.assertIn("fixed target path must start with $HOME/", str(context.exception))


if __name__ == "__main__":
    unittest.main()
