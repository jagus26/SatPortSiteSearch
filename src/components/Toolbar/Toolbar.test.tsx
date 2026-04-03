import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Toolbar } from './Toolbar'

describe('Toolbar', () => {
  it('renders the Add Site button', () => {
    render(<Toolbar onAddSite={() => {}} />)
    expect(screen.getByText('+ Add Site')).toBeInTheDocument()
  })

  it('calls onAddSite when button is clicked', async () => {
    const user = userEvent.setup()
    const onAddSite = vi.fn()
    render(<Toolbar onAddSite={onAddSite} />)

    await user.click(screen.getByText('+ Add Site'))
    expect(onAddSite).toHaveBeenCalledOnce()
  })
})
