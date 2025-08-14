/// <reference types="jest" />
import { render } from '@testing-library/react';
import React from 'react';
import Button from '@/components/ui/Button';

describe('UI smoke tests', () => {
    it('renders Button with text', () => {
        const { getByText } = render(<Button>Click me</Button>);
        expect(getByText('Click me')).toBeInTheDocument();
    });
});
