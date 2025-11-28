# Testing Quick Reference

## Running Tests

### Option 1: Using uv (Recommended)
```bash
uv run pytest -v
```

### Option 2: Using Python directly
```bash
python -m pytest -v
```

### Option 3: Using test runner script
```bash
python run_tests.py
```

## Common Test Commands

### Run all tests
```bash
uv run pytest -v
```

### Run specific test file
```bash
uv run pytest tests/test_auth.py -v
```

### Run specific test
```bash
uv run pytest tests/test_auth.py::test_auth_required_for_chat -v
```

### Run with coverage
```bash
uv run pytest --cov=src --cov-report=html --cov-report=term
```

### Run only fast tests (skip slow ones)
```bash
uv run pytest -m "not slow" -v
```

## Test Status

### Created Tests (13 tests total)
- ✅ `test_auth.py` - 5 authentication tests
- ✅ `test_tenant_isolation.py` - 4 tenant isolation tests  
- ✅ `test_document_processor.py` - 4 document processing tests

### Expected Results
- Some tests may fail if:
  - Database is not running
  - JWT token is not configured
  - Test data doesn't exist

This is normal for initial setup. Tests are meant to verify functionality once the system is fully configured.

## Troubleshooting

### "ModuleNotFoundError: No module named 'src'"
- Fixed by `conftest.py` adding backend dir to sys.path
- Or run from backend directory

### "pytest: command not found"
- Use `uv run pytest` instead of `pytest`
- Or activate venv first

### Tests hang or timeout
- Check if database is accessible
- Check if Redis is running
- Use `--tb=short` for shorter tracebacks

## Next Steps

1. Run tests to see current status
2. Fix any failing tests
3. Add more tests for uncovered areas
4. Aim for 80%+ coverage
