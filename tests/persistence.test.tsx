import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import App from '../src/App';
import { initialScene } from '../src/model';
import { loadProject, saveProject } from '../src/storage';
vi.mock('../src/storage',()=>({loadProject:vi.fn(),saveProject:vi.fn()}));
const project=()=>({version:1 as const,assets:[],scene:{...initialScene,items:[],palette:[]}});
beforeEach(()=>{vi.useFakeTimers();vi.mocked(loadProject).mockReset();vi.mocked(saveProject).mockReset();vi.mocked(saveProject).mockResolvedValue(undefined);});
afterEach(()=>{cleanup();vi.useRealTimers();});
async function mount(){await act(async()=>{render(<App/>);});}
describe('persistence data-loss regressions',()=>{
 it('does not write a loaded project merely because another tab was opened',async()=>{vi.mocked(loadProject).mockResolvedValue(project());await mount();await act(async()=>{await vi.advanceTimersByTimeAsync(1000);});expect(saveProject).not.toHaveBeenCalled();expect(screen.getByText('Сохранено на устройстве')).toBeTruthy();});
 it('never replaces unreadable stored data with the empty initial project',async()=>{vi.mocked(loadProject).mockRejectedValue(new Error('Invalid stored JSON'));await mount();fireEvent.change(screen.getByLabelText('Название композиции'),{target:{value:'Temporary work'}});await act(async()=>{await vi.advanceTimersByTimeAsync(1000);});expect(saveProject).not.toHaveBeenCalled();expect(screen.getByRole('alert').textContent).toContain('Старые данные не перезаписаны');expect(screen.getByText('Автосохранение приостановлено')).toBeTruthy();});
 it('debounces real edits and persists the latest title',async()=>{vi.mocked(loadProject).mockResolvedValue(project());await mount();fireEvent.change(screen.getByLabelText('Название композиции'),{target:{value:'First'}});fireEvent.change(screen.getByLabelText('Название композиции'),{target:{value:'Latest'}});await act(async()=>{await vi.advanceTimersByTimeAsync(500);});expect(saveProject).toHaveBeenCalledTimes(1);expect(vi.mocked(saveProject).mock.calls[0][0].scene.title).toBe('Latest');});
 it('restores the selected composition layout instead of showing an unrelated preset',async()=>{const p=project();p.scene.layout='title';vi.mocked(loadProject).mockResolvedValue(p);await mount();expect(screen.getByRole('button',{name:/Под заголовок/}).classList.contains('active')).toBe(true);});
});
