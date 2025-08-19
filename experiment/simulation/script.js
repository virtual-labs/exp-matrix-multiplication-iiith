        class MPISimulation {
            constructor() {
                this.isRunning = false;
                this.processes = [];
                this.currentMatrixSize = 2;
                this.animationSpeed = 1.0;
                this.isStepMode = false;
                this.stepQueue = [];
                this.currentStep = 0;
                this.setupEventListeners();
                this.initializeProcesses();
                this.generateMatrices();
                this.updateConfigDisplay();
            }

            setupEventListeners() {
                document.getElementById('startBtn').addEventListener('click', () => this.startSimulation());
                document.getElementById('processCountSelector').addEventListener('change', () => {
                    this.initializeProcesses();
                    this.generateMatrices();
                    this.updateConfigDisplay();
                });
                document.getElementById('matrixSizeSelector').addEventListener('change', () => {
                    this.generateMatrices();
                    this.updateConfigDisplay();
                });
                document.getElementById('matrixMode').addEventListener('change', (e) => {
                    const randomizeBtn = document.getElementById('randomizeBtn');
                    if (e.target.value === 'manual') {
                        randomizeBtn.style.display = 'block';
                        this.enableMatrixEditing();
                    } else {
                        randomizeBtn.style.display = 'none';
                        this.disableMatrixEditing();
                        this.generateMatrices();
                    }
                });
                document.getElementById('randomizeBtn').addEventListener('click', () => this.generateMatrices());
                document.getElementById('downloadMPICode').addEventListener('click', () => this.downloadMPICode());
                
                // Speed control
                document.getElementById('speedSlider').addEventListener('input', (e) => {
                    this.animationSpeed = parseFloat(e.target.value);
                    document.getElementById('speedValue').textContent = `${this.animationSpeed.toFixed(1)}x`;
                });
                
                // Execution mode control
                document.getElementById('executionMode').addEventListener('change', (e) => {
                    this.isStepMode = e.target.value === 'step';
                    const stepBtn = document.getElementById('stepBtn');
                    const startBtn = document.getElementById('startBtn');
                    
                    if (this.isStepMode) {
                        stepBtn.style.display = 'block';
                        if (this.isRunning) {
                            startBtn.style.display = 'none';
                        }
                    } else {
                        stepBtn.style.display = 'none';
                        startBtn.style.display = 'block';
                    }
                });
                
                // Step button
                document.getElementById('stepBtn').addEventListener('click', () => this.executeNextStep());
            }

            initializeProcesses() {
                const processCount = parseInt(document.getElementById('processCountSelector').value);
                const grid = document.getElementById('processGrid');
                const cols = Math.ceil(Math.sqrt(processCount));
                grid.style.gridTemplateColumns = `repeat(${cols}, 1fr)`;
                grid.innerHTML = '';
                this.processes = [];

                for (let i = 0; i < processCount; i++) {
                    const processNode = document.createElement('div');
                    processNode.className = 'process-node';
                    processNode.innerHTML = `
                        <div class="process-id">Process ${i} ${i === 0 ? '(Master)' : ''}</div>
                        <div class="process-status">Idle</div>
                        <div class="process-data"></div>`;
                    grid.appendChild(processNode);
                    this.processes.push({ 
                        id: i, 
                        element: processNode, 
                        status: 'idle', 
                        data: null 
                    });
                }
            }

            generateMatrices() {
                const size = parseInt(document.getElementById('matrixSizeSelector').value);
                this.matrixA = this.createRandomMatrix(size);
                this.matrixB = this.createRandomMatrix(size);
                this.matrixC = this.createZeroMatrix(size);
                this.renderMatrix('matrixA', this.matrixA);
                this.renderMatrix('matrixB', this.matrixB);
                this.renderMatrix('matrixC', this.matrixC);
                this.updateConfigDisplay();
            }

            createRandomMatrix(size) {
                return Array.from({ length: size }, () => 
                    Array.from({ length: size }, () => Math.floor(Math.random() * 10))
                );
            }

            createZeroMatrix(size) {
                return Array.from({ length: size }, () => Array(size).fill(0));
            }

            renderMatrix(id, matrix) {
                const element = document.getElementById(id);
                const size = matrix.length;
                element.style.gridTemplateColumns = `repeat(${size}, 1fr)`;
                element.innerHTML = '';

                for (let i = 0; i < size; i++) {
                    for (let j = 0; j < size; j++) {
                        const cell = document.createElement('div');
                        cell.className = 'matrix-cell';
                        cell.textContent = matrix[i][j];
                        cell.dataset.row = i;
                        cell.dataset.col = j;

                        if ((id === 'matrixA' || id === 'matrixB') && 
                            document.getElementById('matrixMode').value === 'manual') {
                            cell.classList.add('editable');
                            cell.contentEditable = true;
                            cell.addEventListener('blur', (e) => {
                                const value = Math.max(0, Math.min(9, parseInt(e.target.textContent) || 0));
                                (id === 'matrixA' ? this.matrixA : this.matrixB)[i][j] = value;
                                e.target.textContent = value;
                            });
                            cell.addEventListener('keydown', (e) => {
                                if (e.key === 'Enter') {
                                    e.preventDefault();
                                    e.target.blur();
                                }
                            });
                        }
                        element.appendChild(cell);
                    }
                }
            }

            enableMatrixEditing() {
                this.renderMatrix('matrixA', this.matrixA);
                this.renderMatrix('matrixB', this.matrixB);
            }

            disableMatrixEditing() {
                this.renderMatrix('matrixA', this.matrixA);
                this.renderMatrix('matrixB', this.matrixB);
            }

            async startSimulation() {
                if (this.isRunning) return;
                
                this.isRunning = true;
                document.getElementById('startBtn').disabled = true;
                document.getElementById('startBtn').textContent = '⏳ Running...';
                this.resetStats();
                
                const processCount = document.getElementById('processCountSelector').value;
                const matrixSize = document.getElementById('matrixSizeSelector').value;
                this.addLog(`Starting MPI simulation with ${processCount} processes`, 'info');
                this.addLog(`Matrix dimensions: ${matrixSize}×${matrixSize}`, 'info');
                this.addLog(`Animation speed: ${this.animationSpeed}x`, 'info');
                
                if (this.isStepMode) {
                    this.addLog('Step mode enabled - use Next Step button to proceed', 'info');
                    this.initializeStepMode();
                    
                    // Setup step mode UI
                    document.getElementById('startBtn').style.display = 'none';
                    const stepBtn = document.getElementById('stepBtn');
                    stepBtn.style.display = 'block';
                    stepBtn.disabled = false;
                    stepBtn.textContent = `➡️ Step 1/${this.stepQueue.length}`;
                    
                    // Initialize matrices for step mode
                    const size = parseInt(document.getElementById('matrixSizeSelector').value);
                    if (!this.matrixA || !this.matrixB) this.generateMatrices();
                    this.matrixC = this.createZeroMatrix(size);
                    this.renderMatrix('matrixC', this.matrixC);
                    
                    const rowsPerProcess = Math.ceil(size / this.processes.length);
                    this.colorCodeMatrixRows(size, this.processes.length, rowsPerProcess);
                    
                    return;
                }
                
                try {
                    await this.runMatrixMultiplication();
                    this.addLog('Matrix multiplication completed successfully', 'success');
                } catch (error) {
                    console.error('Simulation error:', error);
                    this.addLog(`Simulation error: ${error.message}`, 'error');
                } finally {
                    this.isRunning = false;
                    document.getElementById('startBtn').disabled = false;
                    document.getElementById('startBtn').textContent = '🚀 Start Simulation';
                }
            }

            async runMatrixMultiplication() {
                const size = parseInt(document.getElementById('matrixSizeSelector').value);
                const processCount = this.processes.length;
                
                if (!this.matrixA || !this.matrixB) this.generateMatrices();
                
                this.matrixC = this.createZeroMatrix(size);
                this.renderMatrix('matrixC', this.matrixC);
                
                const rowsPerProcess = Math.ceil(size / processCount);
                this.colorCodeMatrixRows(size, processCount, rowsPerProcess);
                
                // Phase 1: Scatter (Communication)
                this.addLog('Phase 1: Scattering matrix data to processes', 'info');
                this.updateProcessStatus(0, 'distributing', 'Sending rows to workers');
                await this.visualizeCommunication('scatter');
                
                // Phase 2: Parallel Computation
                this.addLog('Phase 2: Starting parallel computation', 'info');
                
                const computePromises = this.processes.map((process, i) => {
                    const startRow = i * rowsPerProcess;
                    const endRow = Math.min(startRow + rowsPerProcess, size);
                    
                    if (startRow >= size) return Promise.resolve(null);
                    
                    this.updateProcessStatus(i, 'computing', `Computing rows ${startRow}-${endRow-1}`);
                    return this.simulateProcessWork(i, startRow, endRow, size);
                }).filter(p => p);
                
                const workerResults = await Promise.all(computePromises);
                
                // Phase 3: Gather (Communication)
                this.addLog('Phase 3: Gathering results from processes', 'info');
                this.updateProcessStatus(0, 'gathering', 'Collecting computed results');
                await this.visualizeCommunication('gather');
                
                // Process results
                for (const result of workerResults) {
                    if (!result) continue;
                    
                    for (let i = 0; i < result.rows.length; i++) {
                        const globalRowIndex = result.startRow + i;
                        if (globalRowIndex < size) {
                            this.matrixC[globalRowIndex] = result.rows[i];
                            this.animateRowCompletion(globalRowIndex, result.processId);
                        }
                    }
                }
                
                // Phase 4: Finalize
                this.addLog('Phase 4: Finalizing computation results', 'success');
                this.renderMatrix('matrixC', this.matrixC);
                
                this.processes.forEach(p => this.updateProcessStatus(p.id, 'completed', 'Finished'));
            }

            async simulateProcessWork(processId, startRow, endRow, size) {
                const localResultRows = [];
                
                for (let i = startRow; i < endRow; i++) {
                    const newRow = new Array(size).fill(0);
                    
                    for (let j = 0; j < size; j++) {
                        // Highlight the cell being computed
                        this.highlightMatrixCell('matrixC', i, j, 'computing');
                        
                        // Highlight the corresponding row in matrix A and column in matrix B
                        this.highlightMatrixRow('matrixA', i, 'row-highlight');
                        this.highlightMatrixColumn('matrixB', j, 'col-highlight');
                        
                        // Perform matrix multiplication: C[i][j] = Σ(A[i][k] * B[k][j])
                        let cellValue = 0;
                        for (let k = 0; k < size; k++) {
                            // Highlight the specific cells being multiplied
                            this.highlightMatrixCell('matrixA', i, k, 'multiplying');
                            this.highlightMatrixCell('matrixB', k, j, 'multiplying');
                            
                            cellValue += this.matrixA[i][k] * this.matrixB[k][j];
                            
                            // Brief pause to show the multiplication
                            await this.delay(Math.random() * 30 + 15);
                            
                            // Clear the specific multiplication highlights
                            this.clearMatrixHighlights('multiplying');
                        }
                        newRow[j] = cellValue;
                        
                        // Clear all highlights and animate result
                        this.clearMatrixHighlights('computing');
                        this.clearMatrixHighlights('row-highlight');
                        this.clearMatrixHighlights('col-highlight');
                        this.animateCellCalculation(i, j, cellValue, processId);
                        
                        // Brief pause before next cell
                        await this.delay(Math.random() * 20 + 10);
                    }
                    localResultRows.push(newRow);
                }
                
                return { processId, startRow, rows: localResultRows };
            }

            async visualizeCommunication(type, duration = 1000) {
                const masterNode = this.processes[0].element;
                const workerNodes = this.processes.slice(1).map(p => p.element);

                if (type === 'scatter') {
                    masterNode.classList.add('sending');
                    workerNodes.forEach(node => node.classList.add('receiving'));
                } else if (type === 'gather') {
                    masterNode.classList.add('receiving');
                    workerNodes.forEach(node => node.classList.add('sending'));
                }
                
                await this.delay(duration);
                
                masterNode.classList.remove('sending', 'receiving');
                workerNodes.forEach(node => node.classList.remove('sending', 'receiving'));
            }

            colorCodeMatrixRows(size, processCount, rowsPerProcess) {
                for (let i = 0; i < size; i++) {
                    const processId = Math.floor(i / rowsPerProcess);
                    document.querySelectorAll(`#matrixC .matrix-cell[data-row="${i}"]`).forEach(cell => {
                        cell.classList.add(`process-${processId % 8}`);
                    });
                }
            }
            
            highlightMatrixCell(matrixId, row, col, className) {
                const cell = document.querySelector(`#${matrixId} .matrix-cell[data-row="${row}"][data-col="${col}"]`);
                if (cell) cell.classList.add(className);
            }

            highlightMatrixRow(matrixId, row, className) {
                document.querySelectorAll(`#${matrixId} .matrix-cell[data-row="${row}"]`).forEach(cell => {
                    cell.classList.add(className);
                });
            }

            highlightMatrixColumn(matrixId, col, className) {
                document.querySelectorAll(`#${matrixId} .matrix-cell[data-col="${col}"]`).forEach(cell => {
                    cell.classList.add(className);
                });
            }

            clearMatrixHighlights(className) {
                document.querySelectorAll(`.matrix-cell.${className}`).forEach(cell => cell.classList.remove(className));
            }

            animateCellCalculation(row, col, value, processId) {
                const cell = document.querySelector(`#matrixC .matrix-cell[data-row="${row}"][data-col="${col}"]`);
                if (cell) {
                    cell.textContent = value;
                    cell.style.animation = 'cellCalculation 0.5s ease-in-out';
                    setTimeout(() => { cell.style.animation = ''; }, 500);
                }
            }

            animateRowCompletion(row, processId) {
                document.querySelectorAll(`#matrixC .matrix-cell[data-row="${row}"]`).forEach((cell, index) => {
                    cell.classList.add(`process-${processId % 8}`);
                });
            }

            updateProcessStatus(processId, status, data) {
                if (processId >= this.processes.length) return;
                const p = this.processes[processId];
                p.status = status;
                p.data = data;
                p.element.querySelector('.process-status').textContent = status.charAt(0).toUpperCase() + status.slice(1);
                p.element.querySelector('.process-data').textContent = data || '';
                p.element.classList.remove('computing', 'sending', 'receiving');
                if (status === 'computing') p.element.classList.add('computing');
            }

            updateConfigDisplay() {
                const processCount = document.getElementById('processCountSelector').value;
                const matrixSize = document.getElementById('matrixSizeSelector').value;
                
                document.getElementById('displayProcessCount').textContent = processCount;
                document.getElementById('displayMatrixSize').textContent = `${matrixSize}×${matrixSize}`;
                
                this.currentMatrixSize = parseInt(matrixSize);
            }

            downloadMPICode() {
                const processCount = document.getElementById('processCountSelector').value;
                const matrixSize = document.getElementById('matrixSizeSelector').value;
                
                const mpiCode = this.generateMPICode(processCount, matrixSize);
                
                const blob = new Blob([mpiCode], { type: 'text/plain' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `matrix_multiplication_mpi_${processCount}proc_${matrixSize}x${matrixSize}.c`;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                URL.revokeObjectURL(url);
            }

            generateMPICode(processCount, matrixSize) {
                return `#include <mpi.h>
#include <stdio.h>
#include <stdlib.h>
#include <time.h>

#define N ${matrixSize}
#define NUM_PROCESSES ${processCount}

void initialize_matrix(double matrix[N][N]) {
    srand(time(NULL) + getpid());
    for (int i = 0; i < N; i++) {
        for (int j = 0; j < N; j++) {
            matrix[i][j] = (double)(rand() % 10);
        }
    }
}

void print_matrix(double matrix[N][N], const char* name) {
    printf("\\n%s:\\n", name);
    for (int i = 0; i < N; i++) {
        for (int j = 0; j < N; j++) {
            printf("%6.2f ", matrix[i][j]);
        }
        printf("\\n");
    }
}

int main(int argc, char** argv) {
    int rank, size;
    double A[N][N], B[N][N], C[N][N];
    double local_A[N/NUM_PROCESSES][N], local_C[N/NUM_PROCESSES][N];
    
    MPI_Init(&argc, &argv);
    MPI_Comm_rank(MPI_COMM_WORLD, &rank);
    MPI_Comm_size(MPI_COMM_WORLD, &size);
    
    if (size != NUM_PROCESSES) {
        if (rank == 0) {
            printf("This program requires exactly %d processes.\\n", NUM_PROCESSES);
        }
        MPI_Finalize();
        return 1;
    }
    
    int rows_per_process = N / NUM_PROCESSES;
    
    if (rank == 0) {
        // Master process initializes matrices
        printf("Initializing matrices...\\n");
        initialize_matrix(A);
        initialize_matrix(B);
        
        print_matrix(A, "Matrix A");
        print_matrix(B, "Matrix B");
        
        // Send portions of matrix A to other processes
        for (int i = 1; i < NUM_PROCESSES; i++) {
            MPI_Send(&A[i * rows_per_process][0], 
                    rows_per_process * N, MPI_DOUBLE, i, 0, MPI_COMM_WORLD);
        }
        
        // Copy master's portion
        for (int i = 0; i < rows_per_process; i++) {
            for (int j = 0; j < N; j++) {
                local_A[i][j] = A[i][j];
            }
        }
    } else {
        // Worker processes receive their portion of matrix A
        MPI_Recv(&local_A[0][0], rows_per_process * N, MPI_DOUBLE, 
                0, 0, MPI_COMM_WORLD, MPI_STATUS_IGNORE);
    }
    
    // Broadcast matrix B to all processes
    MPI_Bcast(&B[0][0], N * N, MPI_DOUBLE, 0, MPI_COMM_WORLD);
    
    // Perform local matrix multiplication
    printf("Process %d: Computing local matrix multiplication...\\n", rank);
    for (int i = 0; i < rows_per_process; i++) {
        for (int j = 0; j < N; j++) {
            local_C[i][j] = 0.0;
            for (int k = 0; k < N; k++) {
                local_C[i][j] += local_A[i][k] * B[k][j];
            }
        }
    }
    
    // Gather results back to master
    if (rank == 0) {
        // Copy master's result
        for (int i = 0; i < rows_per_process; i++) {
            for (int j = 0; j < N; j++) {
                C[i][j] = local_C[i][j];
            }
        }
        
        // Receive results from other processes
        for (int i = 1; i < NUM_PROCESSES; i++) {
            MPI_Recv(&C[i * rows_per_process][0], 
                    rows_per_process * N, MPI_DOUBLE, i, 1, MPI_COMM_WORLD, MPI_STATUS_IGNORE);
        }
        
        print_matrix(C, "Result Matrix C = A × B");
        printf("\\nMatrix multiplication completed successfully!\\n");
        
    } else {
        // Send local result to master
        MPI_Send(&local_C[0][0], rows_per_process * N, MPI_DOUBLE, 
                0, 1, MPI_COMM_WORLD);
    }
    
    MPI_Finalize();
    return 0;
}

/*
 * Compilation: mpicc -o matrix_mult matrix_multiplication_mpi_${processCount}proc_${matrixSize}x${matrixSize}.c
 * Execution: mpirun -np ${processCount} ./matrix_mult
 * 
 * This MPI program performs parallel matrix multiplication using ${processCount} processes.
 * Each process computes ${matrixSize / processCount} rows of the result matrix.
 * 
 * Matrix Distribution Strategy:
 * - Master process (rank 0) initializes matrices A and B
 * - Matrix A is divided row-wise among processes
 * - Matrix B is broadcast to all processes
 * - Each process computes its assigned portion of the result
 * - Results are gathered back to the master process
 */`;
            }

            resetStats() {
                this.updateConfigDisplay();
                this.processes.forEach(p => this.updateProcessStatus(p.id, 'idle', ''));
                this.clearLogs();
                this.addLog('System reset and ready for simulation', 'info');
                
                // Reset step mode
                this.currentStep = 0;
                this.stepQueue = [];
                
                const stepBtn = document.getElementById('stepBtn');
                stepBtn.textContent = '➡️ Next Step';
                stepBtn.disabled = false;
                
                // Clear any existing highlights
                this.clearMatrixHighlights('computing');
                this.clearMatrixHighlights('row-highlight');
                this.clearMatrixHighlights('col-highlight');
                this.clearMatrixHighlights('multiplying');
            }

            addLog(message, type = 'info') {
                const logsContainer = document.getElementById('logsContainer');
                if (!logsContainer) return;

                const now = new Date();
                const timeStr = now.toTimeString().split(' ')[0];
                
                const logEntry = document.createElement('div');
                logEntry.className = `log-entry ${type}`;
                logEntry.innerHTML = `
                    <span class="log-time">${timeStr}</span>
                    <span class="log-message">${message}</span>
                `;
                
                logsContainer.appendChild(logEntry);
                logsContainer.scrollTop = logsContainer.scrollHeight;
            }

            clearLogs() {
                const logsContainer = document.getElementById('logsContainer');
                if (logsContainer) {
                    logsContainer.innerHTML = `
                        <div class="log-entry">
                            <span class="log-time">00:00:00</span>
                            <span class="log-message">System initialized and ready</span>
                        </div>
                    `;
                }
            }

            delay(ms) { 
                return new Promise(resolve => setTimeout(resolve, ms / this.animationSpeed)); 
            }

            // Step mode functionality
            initializeStepMode() {
                this.stepQueue = [];
                this.currentStep = 0;
                
                const size = parseInt(document.getElementById('matrixSizeSelector').value);
                const processCount = this.processes.length;
                const rowsPerProcess = Math.ceil(size / processCount);
                
                // Build step queue
                this.stepQueue.push({ type: 'scatter', description: 'Scatter matrix data to processes' });
                
                for (let processId = 0; processId < processCount; processId++) {
                    const startRow = processId * rowsPerProcess;
                    const endRow = Math.min(startRow + rowsPerProcess, size);
                    
                    if (startRow >= size) continue;
                    
                    for (let i = startRow; i < endRow; i++) {
                        for (let j = 0; j < size; j++) {
                            this.stepQueue.push({
                                type: 'compute',
                                processId,
                                row: i,
                                col: j,
                                description: `Process ${processId}: Computing C[${i}][${j}]`
                            });
                        }
                    }
                }
                
                this.stepQueue.push({ type: 'gather', description: 'Gather results from processes' });
                this.stepQueue.push({ type: 'finalize', description: 'Simulation completed' });
            }

            async executeNextStep() {
                if (this.currentStep >= this.stepQueue.length) {
                    this.completeStepModeSimulation();
                    return;
                }
                
                const step = this.stepQueue[this.currentStep];
                this.addLog(`Step ${this.currentStep + 1}/${this.stepQueue.length}: ${step.description}`, 'info');
                
                switch (step.type) {
                    case 'scatter':
                        await this.visualizeCommunication('scatter', 1000);
                        break;
                        
                    case 'compute':
                        await this.executeComputeStep(step);
                        break;
                        
                    case 'gather':
                        await this.visualizeCommunication('gather', 1000);
                        break;
                        
                    case 'finalize':
                        this.addLog('Matrix multiplication completed successfully', 'success');
                        break;
                }
                
                this.currentStep++;
                
                // Update step button text
                const stepBtn = document.getElementById('stepBtn');
                if (this.currentStep >= this.stepQueue.length) {
                    stepBtn.textContent = '✅ Complete';
                    stepBtn.disabled = true;
                } else {
                    stepBtn.textContent = `➡️ Step ${this.currentStep + 1}/${this.stepQueue.length}`;
                }
            }

            async executeComputeStep(step) {
                const { processId, row, col } = step;
                const size = parseInt(document.getElementById('matrixSizeSelector').value);
                
                // Update process status
                this.updateProcessStatus(processId, 'computing', `Computing C[${row}][${col}]`);
                
                // Highlight the cell being computed
                this.highlightMatrixCell('matrixC', row, col, 'computing');
                this.highlightMatrixRow('matrixA', row, 'row-highlight');
                this.highlightMatrixColumn('matrixB', col, 'col-highlight');
                
                // Compute the cell value
                let cellValue = 0;
                for (let k = 0; k < size; k++) {
                    this.highlightMatrixCell('matrixA', row, k, 'multiplying');
                    this.highlightMatrixCell('matrixB', k, col, 'multiplying');
                    
                    cellValue += this.matrixA[row][k] * this.matrixB[k][col];
                    
                    await this.delay(100);
                    this.clearMatrixHighlights('multiplying');
                }
                
                // Update the result matrix
                this.matrixC[row][col] = cellValue;
                this.animateCellCalculation(row, col, cellValue, processId);
                
                // Clear highlights
                this.clearMatrixHighlights('computing');
                this.clearMatrixHighlights('row-highlight');
                this.clearMatrixHighlights('col-highlight');
                
                await this.delay(200);
            }

            completeStepModeSimulation() {
                this.isRunning = false;
                this.processes.forEach(p => this.updateProcessStatus(p.id, 'completed', 'Finished'));
                
                document.getElementById('startBtn').disabled = false;
                document.getElementById('startBtn').textContent = '🚀 Start Simulation';
                document.getElementById('startBtn').style.display = 'block';
                
                const stepBtn = document.getElementById('stepBtn');
                stepBtn.textContent = '➡️ Next Step';
                stepBtn.disabled = false;
                
                this.renderMatrix('matrixC', this.matrixC);
            }
        }

        // Info modal functions
        function toggleInfoModal() {
            const modal = document.getElementById('infoModal');
            if (modal.classList.contains('show')) {
                closeInfoModal();
            } else {
                openInfoModal();
            }
        }

        function openInfoModal() {
            const modal = document.getElementById('infoModal');
            modal.classList.add('show');
            document.body.style.overflow = 'hidden';
        }

        function closeInfoModal(event) {
            if (!event || event.target === document.getElementById('infoModal') || event.target.classList.contains('close-button')) {
                const modal = document.getElementById('infoModal');
                modal.classList.remove('show');
                document.body.style.overflow = '';
            }
        }

        // Make modal functions globally available
        window.toggleInfoModal = toggleInfoModal;
        window.openInfoModal = openInfoModal;
        window.closeInfoModal = closeInfoModal;

        document.addEventListener('DOMContentLoaded', () => {
            new MPISimulation();
            
            // Keyboard shortcuts for info modal
            document.addEventListener('keydown', (e) => {
                if (e.key === 'Escape') {
                    closeInfoModal();
                    return;
                }
                if (e.key === 'F1' || (e.ctrlKey && e.key === 'h')) {
                    e.preventDefault();
                    toggleInfoModal();
                    return;
                }
            });
        });

        // Mobile orientation handling
        function checkOrientation() {
            const overlay = document.querySelector('.rotate-device-overlay');
            const isMobile = window.innerWidth < 768;
            const isPortrait = window.innerHeight > window.innerWidth;
            
            if (isMobile && isPortrait) {
                overlay.style.display = 'flex';
            } else {
                overlay.style.display = 'none';
            }
        }

        // Check orientation on load and resize
        window.addEventListener('load', checkOrientation);
        window.addEventListener('resize', checkOrientation);
        window.addEventListener('orientationchange', () => {
            setTimeout(checkOrientation, 100);
        });