'use client';

export default function TestPage() {
  return (
    <div>
      <h1>Test</h1>
      {true && (
        <div>
          <p>This is a test</p>
        </div>
      )}
    </div>
  );
}