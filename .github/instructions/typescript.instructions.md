---
description: 'TypeScript coding conventions and guidelines'
applyTo: '**/*.ts'
---

# TypeScript Coding Conventions

## TypeScript Instructions

- Write clear and concise comments for each function and significant code block.
- Ensure functions and variables have descriptive names and include type annotations.
- Provide JSDoc comments for functions, methods, classes, and interfaces.
- Use TypeScript types and interfaces to define the shapes of objects and function signatures.
- Break down complex functions into smaller, reusable, and manageable functions.

## General Instructions

- Prioritize readability and clarity in all code.
- For algorithm-related code, include comments explaining the approach used.
- Follow good maintainability practices, including comments on design decisions and rationale.
- Handle edge cases and include clear error handling (using exceptions or error objects as appropriate).
- Document the use and purpose of external libraries or dependencies in code comments.
- Use consistent naming conventions and follow TypeScript/JavaScript best practices.
- Write concise, efficient, and idiomatic TypeScript code that is also easily understandable.

## Code Style and Formatting

- Follow the [Airbnb TypeScript Style Guide](https://github.com/airbnb/javascript), or your team’s preferred style guide.
- Use 2 spaces for indentation (unless your project specifies otherwise).
- Ensure lines do not exceed 100 characters.
- Place JSDoc comments immediately before the function or class declaration.
- Use blank lines to separate logical code blocks, functions, and classes.

## Edge Cases and Testing

- Include test cases for core application logic.
- Account for edge cases such as empty inputs, invalid data types, and large datasets.
- Document edge cases and the expected behavior in comments or JSDoc.
- Write unit tests for all functions and components, documenting the intent and logic of each test.

## Example of Proper Documentation

```typescript
/**
 * Calculates the area of a circle given the radius.
 *
 * @param radius - The radius of the circle.
 * @returns The area of the circle, calculated as π * radius^2.
 * @throws {Error} If the radius is negative.
 */
function calculateArea(radius: number): number {
  if (radius < 0) {
    throw new Error('Radius cannot be negative');
  }
  return Math.PI * radius ** 2;
}
```

## Additional Notes

- Use `interface` or `type` for complex object structures to improve readability.
- Prefer `const` and `let` over `var`.
- Use ES6+ features where appropriate (e.g., arrow functions, template literals, destructuring).
- Prefer `null` checks and type guards to ensure type safety.
- When using asynchronous code, document the behavior and possible rejection reasons.

```typescript
/**
 * Fetches user data from the API.
 *
 * @param userId - The unique identifier for the user.
 * @returns A promise that resolves with the user data.
 * @throws {Error} If the request fails or userId is invalid.
 */
async function fetchUserData(userId: string): Promise<UserData> {
  if (!userId) {
    throw new Error('userId is required');
  }
  // Example using fetch; handle errors appropriately in production code
  const response = await fetch(`/api/users/${userId}`);
  if (!response.ok) {
    throw new Error('Failed to fetch user data');
  }
  return response.json();
}