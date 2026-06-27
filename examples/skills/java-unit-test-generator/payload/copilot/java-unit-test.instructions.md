---
applyTo: "**/*.java"
---

# Java Unit Test Generator

When the user asks to generate unit tests for a Java class, follow these rules:

1. Analyse the class: identify all public/package-private methods, constructor
   dependencies, and return types.
2. Generate a JUnit 5 test class (`{ClassName}Test`) in the same package.
3. Use `@ExtendWith(MockitoExtension.class)`, `@Mock` for each dependency,
   `@InjectMocks` for the system under test.
4. Group tests per method using `@Nested` inner classes.
5. Name test methods: `methodName_scenario_expectedBehaviour()`.
6. Use AssertJ (`assertThat(...)`) for assertions.
7. Use `when(...).thenReturn(...)` for stubs; `verify(...)` for side-effects.
8. Cover per method: happy path, boundary/edge cases, exception paths.
9. Never test private methods directly.
10. Add `// TODO(mock):` comments for unmockable final classes.
