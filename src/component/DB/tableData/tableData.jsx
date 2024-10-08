import React, { useState, useEffect, useRef, useCallback } from 'react';
import axios from 'axios';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import './tableData.css';

export default function TableData() {
    const { buildingId, fileId, tableId } = useParams();
    const location = useLocation();
    const versionId = new URLSearchParams(location.search).get('versionId');
    const { tableTitle, isLastVersion, currentVersion } = location.state || {};
    const [tableData, setTableData] = useState(null);
    const [columns, setColumns] = useState([]);
    const [rows, setRows] = useState([]);
    const [table, setTable] = useState([]);
    const [editQueue, setEditQueue] = useState([]);
    const [selectedCell, setSelectedCell] = useState(null);
    const [deleteEnabled, setDeleteEnabled] = useState(false);
    const [versionName, setVersionName] = useState('');
    const [note, setNote] = useState('');
    const [error, setError] = useState({ visible: false, message: '', target: null });
    const containerRef = useRef(null);
    const navigate = useNavigate();

    const fetchData = useCallback(() => {
        axios.get(`/buildings/${buildingId}/files/${fileId}/tables/${tableId}/datas`, {
            params: { versionId: versionId },
            headers: { 'Content-Type': 'application/json' }
        })
            .then(response => {
                setTableData(response.data);
            })
            .catch(error => {
                console.error('Error fetching table data:', error);
            });
    }, [buildingId, fileId, tableId, versionId]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    useEffect(() => {
        if (tableData && tableData.length > 0) {
            const uniqueColumns = [...new Set(tableData.map(item => item.columnName))];
            const uniqueRows = [...new Set(tableData.map(item => item.rowNumber))];
            setColumns(uniqueColumns);
            setRows(uniqueRows);
            const newTable = uniqueRows.map(rowNum => {
                const row = tableData.filter(item => item.rowNumber === rowNum);
                return uniqueColumns.map(colName => {
                    const cell = row.find(item => item.columnName === colName);
                    return cell ? { ...cell, contents: cell.contents } : { rowNumber: rowNum, columnName: colName, contents: '' };
                });
            });
            setTable(newTable);
        }
    }, [tableData]);

    useEffect(() => {
        function handleClickOutside(event) {
            if (containerRef.current && !containerRef.current.contains(event.target)) {
                setSelectedCell(null);
                setDeleteEnabled(false);
            }
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => {
            document.removeEventListener("mousedown", handleClickOutside);
        };
    }, [containerRef]);

    const handleHeaderContentChange = (index, value) => {
        const newColumns = [...columns];
        newColumns[index] = value;
        setColumns(newColumns);
    };

    const handleHeaderContentBlur = (buildingId, fileId, tableId, columnIndex, value) => {
        setEditQueue([...editQueue, {
            method: 'patch',
            url: `/buildings/${buildingId}/files/${fileId}/tables/${tableId}/columns`,
            params: { columnIndex },
            data: { name: value },
            headers: { 'Content-Type': 'application/json' }
        }]);
    };

    const handleMakeHeader = (buildingId, fileId, tableId, columns) => {
        const newColumnName = prompt("새로운 열 이름을 입력하세요:");
        if (!newColumnName) {
            alert("열 이름을 입력하지 않았습니다.");
            return;
        }

        const newColumnIndex = columns.length;
        const newTable = table.map(row => [...row, { rowNumber: row[0].rowNumber, columnName: newColumnName, contents: '' }]);

        setColumns([...columns, newColumnName]);
        setTable(newTable);
        setEditQueue([...editQueue, {
            method: 'post',
            url: `/buildings/${buildingId}/files/${fileId}/tables/${tableId}/columns`,
            params: { columnIndex: newColumnIndex },
            data: { name: newColumnName },
            headers: { 'Content-Type': 'application/json' }
        }]);
    };

    const handleMakeRow = (buildingId, fileId, tableId, rows, columns, table) => {
        const newRowIndex = Math.max(...rows) + 1;
        const newRow = columns.map(columnName => ({ rowNumber: newRowIndex, columnName, contents: '' }));

        const newTable = [...table, newRow];
        setRows([...rows, newRowIndex]);
        setTable(newTable);
        setEditQueue([...editQueue, {
            method: 'post',
            url: `/buildings/${buildingId}/files/${fileId}/tables/${tableId}/rows`,
            params: { rowIndex: newRowIndex },
            headers: { 'Content-Type': 'application/json' }
        }]);
    };

    const handleDeleteRow = (buildingId, fileId, tableId, rowIndex) => {
        const actualRowIndex = rowIndex + 2;
        if (!selectedCell) return;
        if (isNaN(actualRowIndex) || !rows.includes(actualRowIndex)) {
            alert("유효하지 않은 행 번호입니다.");
            return;
        }
        const confirmDelete = window.confirm(`정말로 ${rowIndex} 행을 삭제하시겠습니까?`);
        if (!confirmDelete) return;

        const newTable = table.filter(row => row[0].rowNumber !== actualRowIndex)
            .map((row, index) => row.map(cell => ({
                ...cell,
                rowNumber: index + 2
            })));
        const newRows = newTable.map(row => row[0].rowNumber);

        setTable(newTable);
        setRows(newRows);
        setSelectedCell(null);
        setDeleteEnabled(false);

        setEditQueue([...editQueue, {
            method: 'delete',
            url: `/buildings/${buildingId}/files/${fileId}/tables/${tableId}/rows`,
            params: { rowIndex: actualRowIndex }
        }]);
    };

    const handleDeleteColumn = (buildingId, fileId, tableId, columnIndex) => {
        if (!selectedCell) return;
        if (isNaN(columnIndex) || columnIndex < 0 || columnIndex >= columns.length) {
            alert("유효한 열 번호를 입력하세요.");
            return;
        }
        const confirmDelete = window.confirm(`정말로 ${columns[columnIndex]} 열을 삭제하시겠습니까?`);
        if (!confirmDelete) return;

        const newColumns = columns.filter((_, idx) => idx !== columnIndex);
        setColumns(newColumns);
        const newTable = table.map(row => row.filter((_, idx) => idx !== columnIndex));
        setTable(newTable);
        setSelectedCell(null);
        setDeleteEnabled(false);

        setEditQueue([...editQueue, {
            method: 'delete',
            url: `/buildings/${buildingId}/files/${fileId}/tables/${tableId}/columns`,
            params: { columnIndex }
        }]);
    };

    const handleCellChange = (rowIndex, cellIndex, value) => {
        const newTable = [...table];
        newTable[rowIndex][cellIndex].contents = value;
        setTable(newTable);
    };

    const handleCellBlur = (buildingId, fileId, tableId, rowIndex, columnIndex, value) => {
        setEditQueue([...editQueue, {
            method: 'patch',
            url: `/buildings/${buildingId}/files/${fileId}/tables/${tableId}/datas`,
            params: { columnIndex, rowIndex },
            data: { contents: value },
            headers: { 'Content-Type': 'application/json' }
        }]);
    };

    const handleCellClick = (rowIndex, cellIndex) => {
        setSelectedCell({ rowIndex, cellIndex });
        setDeleteEnabled(true);
    };

    const handleSaveChanges = async () => {
        if (isLastVersion && !versionName.trim()) {
            const versionNameInput = document.querySelector('input[name="versionName"]');
            versionNameInput.setCustomValidity('이 입력란을 작성하세요');
            versionNameInput.reportValidity();
            return;
        }
    
        setError({ visible: false, message: '', target: null });
    
        try {
            console.log('Starting versioning process');
            const versioningDto = { version: versionName, note };
            console.log('Sending versioning request:', versioningDto);
    
            const response = await axios.post(`/buildings/${buildingId}/files/${fileId}/tables/${tableId}/versions`, versioningDto, {
                headers: { 'Content-Type': 'application/json' }
            });
    
            console.log('Versioning response:', response);

    
            if (response.status === 201) {
                console.log('Version created successfully, starting edit queue processing');

                for (const [index, request] of editQueue.entries()) {
                    console.log(`request ${index + 1} of ${editQueue.length}:`, request);
                }

                for (const [index, request] of editQueue.entries()) {
                    console.log(`Sending request ${index + 1} of ${editQueue.length}:`, request);
                    await axios(request);
                    console.log(`Request ${index + 1} completed`);
                }
    
                alert('모든 변경 사항이 성공적으로 저장되었습니다.');
                setEditQueue([]);
                const newVersionId = response.data.id;
                console.log('Navigating to new version:', newVersionId);
    
                navigate(`/buildings/${buildingId}/files/${fileId}/tables/${tableId}/datas?versionId=${newVersionId}`, {
                    state: {
                        tableTitle: tableTitle,
                        isLastVersion: true,
                        currentVersion: versionName
                    }
                });
            } else {
                console.log('Version creation failed with status:', response.status);
                alert('버전 생성 실패');
            }
        } catch (error) {
            console.error('Error during save changes process:', error);
            alert('오류가 발생했습니다.');
            setEditQueue([]);
        }
    };

    return (
        <div className='main-container'>
            <div className='excel-editor-container'>
                <h1 className='title-name'>{tableTitle}</h1>
                <h3 className='current-version'>{currentVersion ? `${currentVersion}` : '버전 정보 없음'}</h3>
                <div ref={containerRef}>
                    <div className='db-excel-editor'>
                        <div className='table-section'>
                            <div className='table-data-container'>
                                <table className='db-table'>
                                    <thead>
                                        <tr className='first-column'>
                                            <th>#</th>
                                            {columns.map((col, index) => (
                                                <th key={index}>{index}</th>
                                            ))}
                                        </tr>
                                        <tr>
                                            <th> </th>
                                            {columns.map((col, index) => (
                                                <th key={index}>
                                                    <input
                                                        type="text"
                                                        value={col}
                                                        onChange={(e) => handleHeaderContentChange(index, e.target.value)}
                                                        onBlur={(e) => handleHeaderContentBlur(buildingId, fileId, tableId, index, e.target.value)}
                                                    />
                                                </th>
                                            ))}
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {table.map((row, rowIndex) => (
                                            <tr key={rowIndex}>
                                                <td>{rowIndex}</td>
                                                {row.map((cell, cellIndex) => (
                                                    <td
                                                        key={cellIndex}
                                                        className={
                                                            selectedCell && selectedCell.rowIndex === rowIndex && selectedCell.cellIndex === cellIndex
                                                                ? 'highlight-cell highlight-cell-border highlight-cell-background'
                                                                : selectedCell && (selectedCell.rowIndex === rowIndex || selectedCell.cellIndex === cellIndex)
                                                                    ? 'highlight-cell'
                                                                    : ''
                                                        }
                                                        onClick={() => handleCellClick(rowIndex, cellIndex)}
                                                    >
                                                        <input
                                                            type="text"
                                                            value={cell.contents}
                                                            onChange={(e) => handleCellChange(rowIndex, cellIndex, e.target.value)}
                                                            onBlur={(e) => handleCellBlur(buildingId, fileId, tableId, rowIndex + 2, cellIndex, e.target.value)}
                                                            className={selectedCell && selectedCell.rowIndex === rowIndex && selectedCell.cellIndex === cellIndex ? 'highlight-input' : ''}
                                                        />
                                                    </td>
                                                ))}
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                        <div className={`control-section ${!isLastVersion ? 'disabled' : ''}`}>
                            <div className='button-group'>
                                <button className="add-button" onClick={() => handleMakeRow(buildingId, fileId, tableId, rows, columns, table)} disabled={!isLastVersion}>행 추가</button>
                                <button className="delete-button" onClick={() => handleDeleteRow(buildingId, fileId, tableId, selectedCell ? selectedCell.rowIndex : null)} disabled={!isLastVersion || !deleteEnabled}>행 삭제</button>
                            </div>
                            <div className='button-group'>
                                <button className="add-button" onClick={() => handleMakeHeader(buildingId, fileId, tableId, columns)} disabled={!isLastVersion}>열 추가</button>
                                <button className="delete-button" onClick={() => handleDeleteColumn(buildingId, fileId, tableId, selectedCell ? selectedCell.cellIndex : null)} disabled={!isLastVersion || !deleteEnabled}>열 삭제</button>
                            </div>
                            <div className='version-note'>
                                <div>
                                    <span className="file-info-label">버전 이름:</span>
                                    <input
                                        type="text"
                                        name="versionName"
                                        placeholder="새로운 버전 이름 입력"
                                        value={versionName}
                                        onChange={(e) => setVersionName(e.target.value)}
                                        disabled={!isLastVersion}
                                    />
                                    {error.visible && error.target === 'versionName' && (
                                        <div className="custom-tooltip">{error.message}</div>
                                    )}
                                </div>
                                <div>
                                    <span className="file-info-label">비고</span>
                                </div>
                                <div>
                                    <textarea
                                        className='note-textarea'
                                        placeholder="비고 (최대 300자)"
                                        maxLength="300"
                                        value={note}
                                        onChange={(e) => setNote(e.target.value)}
                                        disabled={!isLastVersion}
                                    />
                                </div>
                            </div>
                            <div className='save-button-group'>
                                <button className='save-button' onClick={handleSaveChanges} disabled={!isLastVersion}>저장</button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
